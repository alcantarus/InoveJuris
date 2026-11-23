import { NextResponse } from 'next/server'
import {
  fetchDjenCommunications,
  normalizeDjenItem,
  type DjenSyncFilters,
} from '@/lib/djen'
import { createServiceRoleClient, ServiceRoleConfigError } from '@/lib/supabase-service'
import { authErrorResponse, requireSessionContext } from '@/lib/server-auth'

interface SelectedLawyer {
  id: number
  name: string
  oab_number: string
  uf_oab: string
  label: string
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isMissingTable(error: any): boolean {
  const message = String(error?.message || error || '')
  return message.includes('42P01') || message.includes('relation "public.publications" does not exist')
}

function isRateLimitError(message: string): boolean {
  return message.includes('429') || /limiti/i.test(message)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size))
  return result
}

/** Retentativa curta e limitada; se o 429 persistir, a mensagem orienta aguardar ~1 minuto. */
async function fetchWithRetry(filters: DjenSyncFilters) {
  const waits = [0, 2000, 5000]
  for (let attempt = 0; attempt < waits.length; attempt++) {
    if (waits[attempt]) await sleep(waits[attempt] as number)
    try {
      return await fetchDjenCommunications(filters)
    } catch (error: any) {
      const message = String(error?.message || error)
      if (!isRateLimitError(message) || attempt === waits.length - 1) throw error
    }
  }
  throw new Error('Não foi possível consultar o DJEN.')
}

export async function POST(req: Request) {
  let logId: number | null = null
  let environment = 'production'
  const startedAt = new Date().toISOString()

  try {
    const ctx = await requireSessionContext()
    environment = ctx.environment

    const body = await req.json()
    const startDate = String(body.startDate || '').trim()
    const endDate = String(body.endDate || '').trim()

    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      return NextResponse.json({ success: false, error: 'Informe datas válidas no formato yyyy-mm-dd.' }, { status: 400 })
    }
    if (startDate > endDate) {
      return NextResponse.json({ success: false, error: 'A data inicial não pode ser maior que a final.' }, { status: 400 })
    }

    const rawIds: unknown[] = Array.isArray(body.lawyerIds) ? body.lawyerIds : []
    const lawyerIds: number[] = Array.from(new Set<number>(rawIds.map(value => Number(value))))
      .filter((id): id is number => Number.isInteger(id) && id > 0)
      .slice(0, 200)

    if (lawyerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Selecione ao menos um advogado cadastrado para capturar as publicações.' },
        { status: 400 }
      )
    }

    const pageSize = Number(body.pageSize) === 5 ? 5 : 100
    const requestedMaxPages = Number(body.maxPages)
    const commonFilters: DjenSyncFilters = {
      startDate,
      endDate,
      tribunal: String(body.tribunal || '').trim() || undefined,
      processNumber: String(body.processNumber || '').trim() || undefined,
      page: 1,
      pageSize,
      maxPages: Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
        ? Math.min(Math.floor(requestedMaxPages), 20)
        : 5,
    }

    const client = createServiceRoleClient()

    const { data: lawyerRows, error: lawyerError } = await client
      .from('lawyers')
      .select('id, name, oab_number, uf_oab, environment')
      .eq('environment', environment)
      .in('id', lawyerIds)
      .limit(200)

    if (lawyerError) {
      throw new Error(`Não foi possível consultar os advogados cadastrados: ${lawyerError.message}`)
    }

    const lawyerById = new Map<number, any>()
    ;(lawyerRows || []).forEach((row: any) => lawyerById.set(Number(row.id), row))

    const missingLawyers = lawyerIds.filter(id => !lawyerById.has(id))
    const invalidLawyers: string[] = []
    const validLawyers: SelectedLawyer[] = []

    // Mantém a ordem em que o usuário selecionou os advogados.
    lawyerIds.forEach(id => {
      const row = lawyerById.get(id)
      if (!row) return

      const oabNumber = String(row.oab_number || '').replace(/\D/g, '')
      const ufOab = String(row.uf_oab || '').trim().toUpperCase()
      const label = row.name
        ? `${row.name} · ${oabNumber}/${ufOab || '--'}`
        : `${oabNumber}/${ufOab || '--'}`

      if (!/^\d{1,10}$/.test(oabNumber) || !/^[A-Z]{2}$/.test(ufOab)) {
        invalidLawyers.push(label)
        return
      }

      validLawyers.push({ id, name: row.name || '', oab_number: oabNumber, uf_oab: ufOab, label })
    })

    if (validLawyers.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum advogado selecionado possui OAB e UF válidas. Revise o cadastro no Módulo Advogados.',
        invalidLawyers,
        missingLawyers,
      }, { status: 400 })
    }

    const lawyerOabs = validLawyers.map(lawyer => `${lawyer.oab_number}/${lawyer.uf_oab}`).join(', ')

    // Registro da tentativa. Não impede a sincronização se a tabela de log não existir.
    const logInsert = await client.from('publication_sync_log').insert({
      sync_status: 'Pendente',
      started_at: startedAt,
      date_start: startDate,
      date_end: endDate,
      tribunal: commonFilters.tribunal || null,
      process_number: commonFilters.processNumber || null,
      lawyer_oabs: lawyerOabs,
      environment,
    }).select('id').single()
    logId = logInsert.data?.id != null ? Number(logInsert.data.id) : null

    const seenExternalIds = new Set<string>()
    const normalized: any[] = []
    const processedLawyers: SelectedLawyer[] = []
    const failedLawyers: Array<{ id: number; label: string; error: string }> = []
    let rawFetched = 0
    let totalAvailable = 0
    let pagesFetched = 0
    let rateLimitRemaining: number | null = null
    let rateLimited = false

    // Um request por advogado: a API do DJEN não combina OABs diferentes de forma confiável.
    for (const lawyer of validLawyers) {
      try {
        const syncResult = await fetchWithRetry({
          ...commonFilters,
          oab: lawyer.oab_number,
          ufOab: lawyer.uf_oab,
        })

        rawFetched += syncResult.items.length
        totalAvailable += syncResult.total
        pagesFetched += syncResult.pagesFetched
        rateLimitRemaining = syncResult.rateLimitRemaining ?? rateLimitRemaining

        syncResult.items.forEach(item => {
          const publication = normalizeDjenItem(item)
          if (!publication.external_id || seenExternalIds.has(publication.external_id)) return
          seenExternalIds.add(publication.external_id)
          normalized.push(publication)
        })

        processedLawyers.push(lawyer)
      } catch (error: any) {
        const message = String(error?.message || error)
        failedLawyers.push({ id: lawyer.id, label: lawyer.label, error: message.slice(0, 300) })
        if (isRateLimitError(message)) {
          rateLimited = true
          break
        }
      }

      // Pausa curta entre advogados para não abusar do limite por IP.
      await sleep(400)
    }

    const { data: processRows, error: processError } = await client
      .from('processes')
      .select('id, number')
      .eq('environment', environment)
      .limit(10000)

    if (processError) throw new Error(`Não foi possível consultar os processos: ${processError.message}`)

    const processByNumber = new Map<string, number>()
    ;(processRows || []).forEach((process: any) => {
      const digits = String(process.number || '').replace(/\D/g, '')
      if (digits.length === 20 && !processByNumber.has(digits)) {
        processByNumber.set(digits, Number(process.id))
      }
    })

    const existingById = new Map<string, number>()
    for (const group of chunk(normalized.map(item => item.external_id), 200)) {
      const { data, error } = await client
        .from('publications')
        .select('id, external_id')
        .eq('environment', environment)
        .eq('source', 'DJEN')
        .in('external_id', group)

      if (error) throw error
      ;(data || []).forEach((row: any) => {
        existingById.set(String(row.external_id), Number(row.id))
      })
    }

    const now = new Date().toISOString()
    const toInsert: any[] = []
    const toUpdate: Array<{ id: number; payload: any }> = []

    normalized.forEach(item => {
      const processId = item.process_number ? (processByNumber.get(item.process_number) || null) : null
      const existingId = existingById.get(item.external_id)

      const sourceFields = {
        process_number: item.process_number,
        process_number_masked: item.process_number_masked,
        process_id: processId,
        court: item.court,
        unit: item.unit,
        publication_date: item.publication_date,
        page: item.page,
        communication_number: item.communication_number,
        chamber: item.chamber,
        content: item.content,
        link: item.link,
        document_type: item.document_type,
        communication_type: item.communication_type,
        recipients: item.recipients,
        raw_payload: item.raw_payload,
        synced_at: item.synced_at,
        updated_at: now,
      }

      if (existingId) {
        // Reimportar NUNCA sobrescreve a decisão humana nem cria prazo.
        toUpdate.push({ id: existingId, payload: sourceFields })
      } else {
        toInsert.push({
          ...item,
          ...sourceFields,
          process_id: processId,
          environment,
          status: 'A triar',
          created_at: now,
        })
      }
    })

    if (toInsert.length > 0) {
      for (const group of chunk(toInsert, 200)) {
        const { error } = await client.from('publications').insert(group)
        if (error) throw error
      }
    }

    for (const entry of toUpdate) {
      const { error } = await client
        .from('publications')
        .update(entry.payload)
        .eq('id', entry.id)
        .eq('environment', environment)
      if (error) throw error
    }

    const result = {
      success: true,
      fetched: normalized.length,
      rawFetched,
      totalAvailable,
      pagesFetched,
      inserted: toInsert.length,
      updated: toUpdate.length,
      skipped: rawFetched - normalized.length,
      matchedProcesses: normalized.filter(item => item.process_number && processByNumber.has(item.process_number)).length,
      rateLimitRemaining,
      lawyersSelected: lawyerIds.length,
      lawyersProcessed: processedLawyers.map(lawyer => lawyer.label),
      invalidLawyers,
      missingLawyers,
      failedLawyers,
      rateLimited,
    }

    if (logId != null) {
      try {
        await client.from('publication_sync_log').update({
          sync_status: failedLawyers.length === validLawyers.length ? 'Erro' : 'Sincronizado',
          finished_at: new Date().toISOString(),
          fetched_count: result.fetched,
          inserted_count: result.inserted,
          updated_count: result.updated,
          skipped_count: result.skipped,
          pages_fetched: result.pagesFetched,
          error_message: failedLawyers.length > 0
            ? failedLawyers.map(item => `${item.label}: ${item.error}`).join(' | ').slice(0, 1000)
            : null,
        }).eq('id', logId)
      } catch (logError) {
        console.error('[djen-sync] erro ao registrar conclusão:', logError)
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    const unauthorized = authErrorResponse(error)
    if (unauthorized) return unauthorized

    if (error instanceof ServiceRoleConfigError) {
      return NextResponse.json(
        { success: false, error: 'Servidor sem configuração de service role.' },
        { status: 503 }
      )
    }

    console.error('[djen-sync] erro:', error)
    const message = isMissingTable(error)
      ? 'A tabela de Publicações ainda não existe. Aplique a migration 20261118120000_create_publications.sql no Supabase.'
      : (error?.message || 'Erro interno na sincronização com o DJEN.')
    const status = isRateLimitError(message) ? 502 : 500

    if (logId != null) {
      try {
        const client = createServiceRoleClient()
        await client.from('publication_sync_log').update({
          sync_status: 'Erro',
          finished_at: new Date().toISOString(),
          error_message: message.slice(0, 1000),
        }).eq('id', logId)
      } catch (logError) {
        console.error('[djen-sync] erro ao registrar falha:', logError)
      }
    }

    return NextResponse.json({ success: false, error: message }, { status })
  }
}

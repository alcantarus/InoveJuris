import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  fetchDjenCommunications,
  hasDjenFilter,
  normalizeDjenItem,
  type DjenSyncFilters,
} from '@/lib/djen'
import { defaultKeyProd, defaultUrlProd } from '@/lib/supabase'
import { getAppEnv } from '@/lib/env'

type SupabaseClient = any

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isMissingTable(error: any): boolean {
  const message = String(error?.message || error || '')
  return message.includes('42P01') || message.includes('relation "public.publications" does not exist')
}

async function getClient(): Promise<SupabaseClient> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

  const client = createClient(defaultUrlProd, serviceKey || defaultKeyProd, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (!serviceKey) {
    await client.rpc('set_app_environment', { env_name: getAppEnv() })
  }

  return client
}

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size))
  return result
}

export async function POST(req: Request) {
  let logId: number | null = null
  const startedAt = new Date().toISOString()

  try {
    const body = await req.json()
    const startDate = String(body.startDate || '').trim()
    const endDate = String(body.endDate || '').trim()

    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      return NextResponse.json({ success: false, error: 'Informe datas válidas no formato yyyy-mm-dd.' }, { status: 400 })
    }
    if (startDate > endDate) {
      return NextResponse.json({ success: false, error: 'A data inicial não pode ser maior que a final.' }, { status: 400 })
    }

    const pageSize = Number(body.pageSize) === 5 ? 5 : 100
    const requestedMaxPages = Number(body.maxPages)
    const filters: DjenSyncFilters = {
      startDate,
      endDate,
      tribunal: String(body.tribunal || '').trim() || undefined,
      processNumber: String(body.processNumber || '').trim() || undefined,
      oab: String(body.oab || '').trim() || undefined,
      ufOab: String(body.ufOab || '').trim() || undefined,
      lawyerName: String(body.lawyerName || '').trim() || undefined,
      partyName: String(body.partyName || '').trim() || undefined,
      page: 1,
      pageSize,
      maxPages: Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
        ? Math.min(Math.floor(requestedMaxPages), 20)
        : 5,
    }

    if (!hasDjenFilter(filters)) {
      return NextResponse.json(
        { success: false, error: 'Informe ao menos um filtro: tribunal, processo, OAB, advogado ou parte.' },
        { status: 400 }
      )
    }

    const client = await getClient()
    const environment = getAppEnv()

    // Registro da tentativa. Não impede a sincronização se a tabela de log não existir.
    const logInsert = await client.from('publication_sync_log').insert({
      sync_status: 'Pendente',
      started_at: startedAt,
      date_start: startDate,
      date_end: endDate,
      tribunal: filters.tribunal || null,
      process_number: filters.processNumber || null,
      environment,
    }).select('id').single()
    logId = logInsert.data?.id != null ? Number(logInsert.data.id) : null

    const syncResult = await fetchDjenCommunications(filters)

    // Remove duplicatas devolvidas em mais de uma página.
    const seen = new Set<string>()
    const normalized = syncResult.items
      .map(normalizeDjenItem)
      .filter(item => {
        if (!item.external_id || seen.has(item.external_id)) return false
        seen.add(item.external_id)
        return true
      })

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
      totalAvailable: syncResult.total,
      pagesFetched: syncResult.pagesFetched,
      inserted: toInsert.length,
      updated: toUpdate.length,
      skipped: syncResult.items.length - normalized.length,
      matchedProcesses: normalized.filter(item => item.process_number && processByNumber.has(item.process_number)).length,
      rateLimitRemaining: syncResult.rateLimitRemaining,
    }

    if (logId != null) {
      try {
        await client.from('publication_sync_log').update({
          sync_status: 'Sincronizado',
          finished_at: new Date().toISOString(),
          fetched_count: result.fetched,
          inserted_count: result.inserted,
          updated_count: result.updated,
          skipped_count: result.skipped,
          pages_fetched: result.pagesFetched,
          error_message: null,
        }).eq('id', logId)
      } catch (logError) {
        console.error('[djen-sync] erro ao registrar conclusão:', logError)
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[djen-sync] erro:', error)
    const message = isMissingTable(error)
      ? 'A tabela de Publicações ainda não existe. Aplique a migration 20261118120000_create_publications.sql no Supabase.'
      : (error?.message || 'Erro interno na sincronização com o DJEN.')
    const status = message.includes('429') || message.includes('limiti') ? 502 : 500

    if (logId != null) {
      try {
        const client = await getClient()
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

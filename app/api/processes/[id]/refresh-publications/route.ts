import { NextResponse, after } from 'next/server'
import { fetchDjenCommunications, normalizeDjenItem, type NormalizedPublication } from '@/lib/djen'
import { chunk, upsertPublications } from '@/lib/publications-sync'
import { createServiceRoleClient, ServiceRoleConfigError } from '@/lib/supabase-service'
import { requireSessionContext } from '@/lib/server-auth'

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const startedAt = new Date().toISOString()
  let logId: number | null = null
  let environment = 'production'
  let processNumberForLog: string | null = null

  try {
    const ctx = await requireSessionContext()
    environment = ctx.environment

    const { id } = await context.params
    const processId = Number(id)
    if (!Number.isInteger(processId) || processId <= 0) {
      return NextResponse.json({ error: 'ID de processo inválido.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const requestedDays = Number(body?.days)
    const days = Number.isFinite(requestedDays) && requestedDays > 0
      ? Math.min(Math.floor(requestedDays), 90)
      : 7

    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

    const client = createServiceRoleClient()

    const { data: processRow, error: processError } = await client
      .from('processes')
      .select('id, number')
      .eq('id', processId)
      .eq('environment', environment)
      .maybeSingle()

    if (processError) throw processError
    if (!processRow) {
      return NextResponse.json({ error: 'Processo não encontrado neste ambiente.' }, { status: 404 })
    }

    const digits = String(processRow.number || '').replace(/\D/g, '')
    processNumberForLog = digits || String(processRow.number || '')

    if (digits.length !== 20) {
      return NextResponse.json(
        { error: 'O processo não possui número CNJ válido (20 dígitos).' },
        { status: 400 }
      )
    }

    const logInsert = await client
      .from('publication_sync_log')
      .insert({
        sync_status: 'Pendente',
        started_at: startedAt,
        date_start: isoDate(startDate),
        date_end: isoDate(endDate),
        process_number: digits,
        environment,
      })
      .select('id')
      .single()

    logId = logInsert.data?.id != null ? Number(logInsert.data.id) : null

    // Uma única consulta ao DJEN, filtrada pelo número do processo.
    // Sem OAB, sem varredura de carteira e sem carregar 10.000 processos.
    const syncResult = await fetchDjenCommunications({
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
      processNumber: digits,
      page: 1,
      pageSize: 100,
      maxPages: 3,
    })

    const seen = new Set<string>()
    const normalized: NormalizedPublication[] = []
    syncResult.items.forEach((item) => {
      const publication = normalizeDjenItem(item)
      if (!publication.external_id || seen.has(publication.external_id)) return
      seen.add(publication.external_id)
      normalized.push(publication)
    })

    const existingById = new Set<string>()
    for (const group of chunk(normalized.map((item) => item.external_id), 200)) {
      const { data, error } = await client
        .from('publications')
        .select('external_id')
        .eq('environment', environment)
        .eq('source', 'DJEN')
        .in('external_id', group)

      if (error) throw error
      ;(data || []).forEach((row: any) => existingById.add(String(row.external_id)))
    }

    const inserted = normalized.filter((item) => !existingById.has(item.external_id)).length
    const updated = normalized.length - inserted
    const now = new Date().toISOString()

    await upsertPublications(client, normalized, environment, processId, now)

    const lastDjenAt = normalized
      .map((item) => item.publication_date)
      .filter(Boolean)
      .sort()
      .pop() || null

    const result = {
      success: true,
      processId,
      processNumber: digits,
      days,
      fetched: normalized.length,
      rawFetched: syncResult.items.length,
      inserted,
      updated,
      skipped: syncResult.items.length - normalized.length,
      pagesFetched: syncResult.pagesFetched,
      lastDjenAt,
      rateLimitRemaining: syncResult.rateLimitRemaining,
    }

    if (logId != null) {
      after(async () => {
        await client
          .from('publication_sync_log')
          .update({
            sync_status: 'Sincronizado',
            finished_at: new Date().toISOString(),
            fetched_count: result.fetched,
            inserted_count: result.inserted,
            updated_count: result.updated,
            skipped_count: result.skipped,
            pages_fetched: result.pagesFetched,
          })
          .eq('id', logId)
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = errorMessage(error)

    if (logId != null) {
      after(async () => {
        try {
          const client = createServiceRoleClient()
          await client
            .from('publication_sync_log')
            .update({
              sync_status: 'Erro',
              finished_at: new Date().toISOString(),
              error_message: message.slice(0, 500),
            })
            .eq('id', logId)
        } catch {
          // o log é best-effort; a resposta ao usuário não depende dele
        }
      })
    }

    const status = error instanceof ServiceRoleConfigError
      ? 500
      : message.includes('429')
        ? 429
        : message.includes('não conect')
          ? 502
          : 500

    return NextResponse.json(
      { success: false, error: message || 'Não foi possível atualizar as publicações.' },
      { status }
    )
  }
}

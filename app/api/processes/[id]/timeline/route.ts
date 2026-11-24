import { NextResponse } from 'next/server'
import { createServiceRoleClient, ServiceRoleConfigError } from '@/lib/supabase-service'
import { requireSessionContext } from '@/lib/server-auth'
import { buildProcessTimeline } from '@/lib/process-timeline'

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireSessionContext()
    const { id } = await context.params
    const processId = Number(id)

    if (!Number.isInteger(processId) || processId <= 0) {
      return NextResponse.json({ error: 'ID de processo inválido.' }, { status: 400 })
    }

    const client = createServiceRoleClient()

    const { data: processRow, error: processError } = await client
      .from('processes')
      .select('id, number, history, last_update')
      .eq('id', processId)
      .eq('environment', ctx.environment)
      .maybeSingle()

    if (processError) throw processError
    if (!processRow) {
      return NextResponse.json({ error: 'Processo não encontrado neste ambiente.' }, { status: 404 })
    }

    const digits = String(processRow.number || '').replace(/\D/g, '')

    let publicationsQuery = client
      .from('publications')
      .select('id, external_id, process_id, process_number, court, unit, publication_date, communication_number, chamber, content, link, document_type, communication_type, suggested_days, deadline_id, status, created_at')
      .eq('environment', ctx.environment)

    if (digits.length === 20) {
      publicationsQuery = publicationsQuery.or(`process_id.eq.${processId},process_number.eq.${digits}`)
    } else {
      publicationsQuery = publicationsQuery.eq('process_id', processId)
    }

    const { data: publications, error: publicationsError } = await publicationsQuery
      .order('publication_date', { ascending: false })
      .limit(300)

    if (publicationsError) throw publicationsError

    const { data: deadlines, error: deadlinesError } = await client
      .from('process_deadlines')
      .select('id, process_id, deadline_date, description, status')
      .eq('environment', ctx.environment)
      .eq('process_id', processId)
      .order('deadline_date', { ascending: true })

    if (deadlinesError) throw deadlinesError

    const { data: syncLog, error: syncLogError } = await client
      .from('process_sync_log')
      .select('sync_status, last_sync, error_message')
      .eq('process_id', processId)
      .eq('environment', ctx.environment)
      .maybeSingle()

    if (syncLogError) throw syncLogError

    const lastSyncTime = syncLog?.last_sync ? Date.parse(String(syncLog.last_sync)) : 0
    const stale = !lastSyncTime || Date.now() - lastSyncTime > 30 * 60 * 1000
    const degraded = !syncLog || syncLog.sync_status !== 'Sincronizado'

    const timeline = buildProcessTimeline({
      processId,
      processNumber: String(processRow.number || ''),
      history: processRow.history,
      publications: publications || [],
      deadlines: deadlines || [],
      degraded,
      stale,
      sync: syncLog
        ? {
            status: syncLog.sync_status ? String(syncLog.sync_status) : null,
            lastSync: syncLog.last_sync ? String(syncLog.last_sync) : null,
            error: syncLog.error_message ? String(syncLog.error_message) : null,
          }
        : null,
    })

    return NextResponse.json(timeline)
  } catch (error) {
    if (error instanceof ServiceRoleConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(
      { error: errorMessage(error) || 'Não foi possível montar a timeline do processo.' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchDatajud } from '@/lib/datajud'
import { defaultKeyProd, defaultUrlProd } from '@/lib/supabase'
import { getAppEnv } from '@/lib/env'

type SupabaseClient = any

interface SyncRow {
  process_id: number
  process_number: string
  sync_status: string
  last_sync: string
  error_message: string | null
  environment?: string
}

function isMissingEnvironment(error: any): boolean {
  const message = String(error?.message || error || '')
  return message.includes('42703') || message.includes('process_sync_log.environment')
}

async function getClient(): Promise<SupabaseClient> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

  const client = createClient(defaultUrlProd, serviceKey || defaultKeyProd, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Sem service role, ainda respeita o isolamento lógico via RPC.
  if (!serviceKey) {
    await client.rpc('set_app_environment', { env_name: getAppEnv() })
  }

  return client
}

async function saveSyncStatus(client: SupabaseClient, row: SyncRow): Promise<void> {
  const persist = async (payload: SyncRow) => {
    const { data, error } = await client
      .from('process_sync_log')
      .update(payload)
      .eq('process_id', payload.process_id)
      .select()

    if (error) throw error

    if (!data || data.length === 0) {
      const { error: insertError } = await client.from('process_sync_log').insert(payload)
      if (insertError) throw insertError
    }
  }

  try {
    await persist(row)
  } catch (error) {
    // Compatibilidade com bancos que ainda não receberam a migration da coluna environment.
    if (!isMissingEnvironment(error) || !row.environment) throw error
    const fallback = { ...row }
    delete fallback.environment
    await persist(fallback)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const processId = Number(body.process_id)
    const processNumber = String(body.process_number || '').trim()

    if (!Number.isInteger(processId) || processId <= 0 || !processNumber) {
      return NextResponse.json(
        { success: false, error: 'process_id e process_number são obrigatórios.' },
        { status: 400 }
      )
    }

    const apiKey = process.env.DATAJUD_API_KEY
    const client = await getClient()
    const now = new Date().toISOString()

    let result
    try {
      result = await fetchDatajud(processNumber, apiKey || '')
    } catch (error: any) {
      const message = error?.message || 'Falha ao consultar o DataJud.'
      await saveSyncStatus(client, {
        process_id: processId,
        process_number: processNumber,
        sync_status: 'Erro',
        last_sync: now,
        error_message: message,
        environment: getAppEnv(),
      }).catch((saveError) => console.error('[process-sync] erro ao registrar falha:', saveError))

      const status = message.includes('DATAJUD_API_KEY') || message.includes('inválida') ? 500 : 502
      return NextResponse.json({ success: false, error: message }, { status })
    }

    const lastUpdate = result.meta.mostRecentUpdate || now
    const env = getAppEnv()

    const { error: updateError } = await client
      .from('processes')
      .update({
        history: result.history,
        last_update: lastUpdate,
      })
      .eq('id', processId)
      .eq('environment', env)

    if (updateError) {
      throw new Error(`Não foi possível salvar os andamentos no processo: ${updateError.message}`)
    }

    await saveSyncStatus(client, {
      process_id: processId,
      process_number: processNumber,
      sync_status: 'Sincronizado',
      last_sync: now,
      error_message: null,
      environment: env,
    })

    return NextResponse.json({
      success: true,
      processNumber: result.processNumber,
      history: result.history,
      movements: result.history.length,
      lastUpdate,
    })
  } catch (error: any) {
    console.error('[process-sync] erro:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno na sincronização.' },
      { status: 500 }
    )
  }
}

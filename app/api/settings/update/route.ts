import { NextResponse } from 'next/server'
import { authErrorResponse, requireAdminContext } from '@/lib/server-auth'
import { createServiceRoleClient, ServiceRoleConfigError } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

// Chaves operacionais: so podem ser gravadas por rotas de servidor.
// backup_status e escrito por /api/backup/generate; email_oauth_* guarda
// tokens OAuth e nunca deve aceitar valor vindo do navegador.
const RESERVED_KEYS = new Set(['backup_status'])
const RESERVED_PREFIXES = ['email_oauth_']

const KEY_PATTERN = /^[a-z][a-z0-9_]{2,63}$/

function isWritableKey(key: string): boolean {
  if (!KEY_PATTERN.test(key)) return false
  if (RESERVED_KEYS.has(key)) return false
  return !RESERVED_PREFIXES.some((prefix) => key.startsWith(prefix))
}

export async function POST(request: Request) {
  try {
    // Autorizacao no servidor: nao confia no cliente nem em cookies crus.
    const admin = await requireAdminContext('settings')

    const parsed: unknown = await request.json().catch(() => null)
    const body =
      parsed !== null && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : null

    const key = typeof body?.key === 'string' ? body.key.trim() : ''

    if (!isWritableKey(key)) {
      return NextResponse.json({ error: 'Configuração inválida.' }, { status: 400 })
    }

    if (!body || !('value' in body) || body.value === null || body.value === undefined) {
      return NextResponse.json(
        { error: 'O valor da configuração é obrigatório.' },
        { status: 400 }
      )
    }

    // environment e updated_by vem da sessao validada, nunca do corpo.
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
      .from('system_settings')
      .upsert(
        {
          key,
          value: body.value,
          environment: admin.environment,
          organization_id: admin.organizationId,
          updated_at: new Date().toISOString(),
          updated_by: admin.userId,
        },
        { onConflict: 'key,environment,organization_id' }
      )
      .select('key, environment, updated_at')
      .single()

    if (error) {
      console.error(`[settings/update] Falha ao gravar "${key}":`, error)
      return NextResponse.json(
        { error: 'Não foi possível salvar a configuração.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, setting: data })
  } catch (error: unknown) {
    const unauthorized = authErrorResponse(error)
    if (unauthorized) return unauthorized

    if (error instanceof ServiceRoleConfigError) {
      console.error('[settings/update]', error.message)
      return NextResponse.json(
        { error: 'Servidor sem configuração de escrita.' },
        { status: 500 }
      )
    }

    console.error('[settings/update] Erro:', error)
    return NextResponse.json(
      { error: 'Falha ao salvar configuração.' },
      { status: 500 }
    )
  }
}

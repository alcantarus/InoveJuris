import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { defaultKeyProd, defaultUrlProd } from '@/lib/supabase'

export class AdminAuthError extends Error {
  status: number

  constructor(message: string, status = 403) {
    super(message)
    this.status = status
  }
}

export type SessionContext = {
  sessionId: string
  environment: string
  userId: number
  user: Record<string, any>
}

export type AdminContext = SessionContext

/**
 * Valida a sessao no servidor. Nao confia em cookies crus nem em
 * identificadores enviados no corpo. Usada por rotas que nao exigem admin.
 */
export async function requireSessionContext(): Promise<SessionContext> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  const environment = cookieStore.get('app_env')?.value || 'production'

  if (!sessionId) {
    throw new AdminAuthError('Sessão inválida.', 401)
  }

  const client = createClient(defaultUrlProd, defaultKeyProd)
  const { data, error } = await client.rpc('app_validate_session', {
    p_session_id: sessionId,
    p_environment: environment,
  })

  if (error || data?.valid !== true || !data?.user) {
    throw new AdminAuthError('Sessão inválida.', 401)
  }

  const user = data.user as Record<string, any>
  const userId = Number(user.id)

  if (!Number.isFinite(userId)) {
    throw new AdminAuthError('Sessão inválida.', 401)
  }

  return { sessionId, environment, userId, user }
}

/**
 * Valida a sessao e exige permissao administrativa.
 */
export async function requireAdminContext(
  permission: 'settings' | 'audit' = 'settings'
): Promise<AdminContext> {
  const ctx = await requireSessionContext()
  const user = ctx.user

  const isAdmin =
    user.is_superadmin === true ||
    user.canAccessUsers === true ||
    (permission === 'audit'
      ? user.canAccessAudit === true
      : user.canAccessSettings === true)

  if (!isAdmin) {
    throw new AdminAuthError('Acesso negado.', 403)
  }

  return ctx
}

export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return null
}

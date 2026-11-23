import { NextResponse } from 'next/server'
import { authErrorResponse, requireSuperadminContext } from '@/lib/server-auth'
import { createServiceRoleClient, ServiceRoleConfigError } from '@/lib/supabase-service'

export const runtime = 'nodejs'

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

function parseId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function POST(request: Request) {
  try {
    const ctx = await requireSuperadminContext()

    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const supabase = createServiceRoleClient()
    const base = { p_session_id: ctx.sessionId }

    if (action === 'get') {
      const { data, error } = await supabase.rpc('app_get_rbac', base)
      if (error) throw error
      if (!data?.success) return fail(data?.error || 'Falha ao carregar permissões.', 403)

      return NextResponse.json({
        success: true,
        permissions: data.permissions || [],
        roles: data.roles || [],
      })
    }

    if (action === 'save_role') {
      const name = String(body.name || '').trim()
      const description = body.description == null ? null : String(body.description).slice(0, 500)
      const id = parseId(body.id)

      if (!name || name.length > 100) return fail('Nome do perfil inválido.')
      if (body.id !== null && body.id !== undefined && body.id !== '' && id === null) {
        return fail('Perfil inválido.')
      }

      const { data, error } = await supabase.rpc('app_admin_save_role', {
        ...base,
        p_id: id,
        p_name: name,
        p_description: description,
      })
      if (error) throw error
      if (!data?.success) return fail(data?.error || 'Falha ao salvar o perfil.', 400)

      return NextResponse.json({ success: true, id: data.id })
    }

    if (action === 'delete_role') {
      const id = parseId(body.id)
      if (id === null) return fail('Perfil inválido.')

      const { data, error } = await supabase.rpc('app_admin_delete_role', {
        ...base,
        p_id: id,
      })
      if (error) throw error
      if (!data?.success) return fail(data?.error || 'Falha ao excluir o perfil.', 400)

      return NextResponse.json({ success: true })
    }

    if (action === 'set_permission') {
      const roleId = parseId(body.roleId)
      const permissionSlug = String(body.permissionSlug || '')
      const enabled = body.enabled === true

      if (roleId === null) return fail('Perfil inválido.')
      if (!/^[a-z0-9_]{1,100}$/.test(permissionSlug)) return fail('Permissão inválida.')

      const { data, error } = await supabase.rpc('app_admin_set_role_permission', {
        ...base,
        p_role_id: roleId,
        p_permission_slug: permissionSlug,
        p_enabled: enabled,
      })
      if (error) throw error
      if (!data?.success) return fail(data?.error || 'Falha ao alterar a permissão.', 400)

      return NextResponse.json({ success: true })
    }

    return fail('Ação inválida.')
  } catch (error: any) {
    const unauthorized = authErrorResponse(error)
    if (unauthorized) return unauthorized

    if (error instanceof ServiceRoleConfigError) {
      return NextResponse.json(
        { success: false, error: 'Servidor sem configuração de service role.' },
        { status: 503 }
      )
    }

    console.error('[rbac] erro:', error)
    return fail('Erro interno ao gerenciar perfis.', 500)
  }
}

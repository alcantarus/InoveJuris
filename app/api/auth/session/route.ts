import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServer } from '@/lib/supabase-server'
import { UAParser } from 'ua-parser-js'
import { AppEnv } from '@/lib/env'

const isEnv = (value: unknown): value is AppEnv => value === 'production' || value === 'test'

function getIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'Unknown'
}

function getReadableUserAgent(request: Request, supplied?: unknown) {
  const raw = typeof supplied === 'string' && supplied.trim() ? supplied : request.headers.get('user-agent') || 'Unknown'
  const parser = new UAParser(raw)
  const browser = parser.getBrowser()
  const os = parser.getOS()
  const device = parser.getDevice()

  if (browser.name && os.name) {
    const mobile = device.type === 'mobile' ? ' (Mobile)' : ''
    return `${browser.name} no ${os.name}${mobile}`.slice(0, 500)
  }

  return raw.slice(0, 500)
}

async function getAuthContext() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value || null
  const cookieEnv = cookieStore.get('app_env')?.value
  const environment: AppEnv = isEnv(cookieEnv) ? cookieEnv : 'production'
  return { sessionId, environment }
}

function setAuthCookies(response: NextResponse, sessionId: string, environment: AppEnv) {
  const secure = process.env.NODE_ENV === 'production'
  const options = {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
  }

  // Sem maxAge/expires: ambas são cookies de sessão e morrem ao fechar o navegador.
  response.cookies.set('session_id', sessionId, options)
  response.cookies.set('app_env', environment, options)
}

function clearAuthCookies(response: NextResponse) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  }
  response.cookies.set('session_id', '', { ...options, maxAge: 0 })
  response.cookies.set('app_env', '', { ...options, maxAge: 0 })
}

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : ''
    const supabase = await getSupabaseServer()
    const context = await getAuthContext()
    const ip = getIp(request)
    const userAgent = getReadableUserAgent(request, body.userAgent)

    // ---- Autenticação: credenciais nunca são comparadas no cliente ----
    if (action === 'authenticate') {
      const email = typeof body.email === 'string' ? body.email : ''
      const password = typeof body.password === 'string' ? body.password : ''

      const { data, error } = await supabase.rpc('app_authenticate', {
        p_email: email,
        p_password: password,
        p_ip: ip,
        p_user_agent: userAgent,
      })

      if (error) return fail('Não foi possível validar as credenciais.', 500)
      if (!data?.success) return fail(data?.error || 'E-mail ou senha inválidos.', 401)

      return NextResponse.json({
        success: true,
        user: data.user,
        challenge: data.challenge,
      })
    }

    // ---- Troca do challenge por uma sessão opaca ----
    if (action === 'login') {
      const environment = body.environment
      if (!isEnv(environment)) return fail('Ambiente inválido.')

      const challenge = typeof body.challenge === 'string' ? body.challenge : ''
      if (!challenge) return fail('Validação de login inválida.')

      const { data, error } = await supabase.rpc('app_complete_login', {
        p_challenge: challenge,
        p_environment: environment,
        p_ip: ip,
        p_user_agent: userAgent,
      })

      if (error) return fail('Não foi possível iniciar a sessão.', 500)
      if (!data?.success) return fail(data?.error || 'Não foi possível iniciar a sessão.', 403)

      const response = NextResponse.json({ success: true, user: data.user })
      setAuthCookies(response, String(data.sessionId), environment)
      return response
    }

    // ---- Validação server-side no carregamento da aplicação ----
    if (action === 'validate') {
      if (!context.sessionId) return NextResponse.json({ valid: false })

      const { data, error } = await supabase.rpc('app_validate_session', {
        p_session_id: context.sessionId,
        p_environment: context.environment,
      })

      if (error || !data?.valid) return NextResponse.json({ valid: false })
      return NextResponse.json({ valid: true, user: data.user })
    }

    // Aviso enviado no fechamento da aba/janela (sendBeacon). Encerra todas
    // as sessões ativas do usuário, inclusive as de outros dispositivos.
    if (action === 'close_session') {
      if (context.sessionId) {
        await supabase.rpc('app_logout_all_user_sessions', { p_session_id: context.sessionId })
      }
      const response = NextResponse.json({ success: true })
      clearAuthCookies(response)
      return response
    }

    if (action === 'heartbeat') {
      if (!context.sessionId) {
        const response = NextResponse.json({ valid: false }, { status: 401 })
        clearAuthCookies(response)
        return response
      }

      const { data, error } = await supabase.rpc('app_heartbeat', {
        p_session_id: context.sessionId,
        p_environment: context.environment,
      })

      if (error || !data?.valid) {
        const response = NextResponse.json({ valid: false }, { status: 401 })
        clearAuthCookies(response)
        return response
      }

      return NextResponse.json({ valid: true })
    }

    if (action === 'logout') {
      if (context.sessionId) {
        await supabase.rpc('app_logout', { p_session_id: context.sessionId })
      }
      const response = NextResponse.json({ success: true })
      clearAuthCookies(response)
      return response
    }

    if (action === 'switch_environment') {
      if (!context.sessionId) return fail('Sessão inválida.', 401)
      if (!isEnv(body.environment)) return fail('Ambiente inválido.')

      const { data, error } = await supabase.rpc('app_switch_environment', {
        p_session_id: context.sessionId,
        p_environment: body.environment,
      })

      if (error) return fail('Não foi possível trocar de ambiente.', 500)
      if (!data?.success) return fail(data?.error || 'Não foi possível trocar de ambiente.', 403)

      const response = NextResponse.json({ success: true })
      setAuthCookies(response, context.sessionId, body.environment)
      return response
    }

    // ---- Administração de usuários (todas com sessão válida no servidor) ----
    if (action === 'admin_save_user') {
      if (!context.sessionId) return fail('Sessão inválida.', 401)

      const { data, error } = await supabase.rpc('app_admin_save_user', {
        p_session_id: context.sessionId,
        p_payload: body.payload || {},
      })

      if (error) return fail('Acesso negado ou dados inválidos.', 403)
      if (!data?.success) return fail(data?.error || 'Não foi possível salvar o usuário.', 400)
      return NextResponse.json({ success: true, user: data.user })
    }

    if (action === 'admin_delete_user') {
      if (!context.sessionId) return fail('Sessão inválida.', 401)

      const { data, error } = await supabase.rpc('app_admin_delete_user', {
        p_session_id: context.sessionId,
        p_user_id: body.userId,
      })

      if (error) return fail('Acesso negado.', 403)
      if (!data?.success) return fail(data?.error || 'Não foi possível excluir o usuário.', 400)
      return NextResponse.json({ success: true })
    }

    if (action === 'impersonate') {
      if (!context.sessionId) return fail('Sessão inválida.', 401)

      const { data, error } = await supabase.rpc('app_admin_impersonate', {
        p_session_id: context.sessionId,
        p_target_user_id: body.targetUserId,
        p_ip: ip,
        p_user_agent: userAgent,
      })

      if (error) return fail('Acesso negado.', 403)
      if (!data?.success) return fail(data?.error || 'Não foi possível assumir este usuário.', 400)
      return NextResponse.json({ success: true, user: data.user, challenge: data.challenge })
    }

    // ---- Logs e dispositivos confiáveis ----
    if (action === 'security_data') {
      if (!context.sessionId) return fail('Sessão inválida.', 401)

      const { data, error } = await supabase.rpc('app_get_security_data', {
        p_session_id: context.sessionId,
        p_environment: context.environment,
      })

      if (error) return fail('Acesso negado.', 403)
      return NextResponse.json({ success: true, data })
    }

    if (action === 'admin_terminate_session') {
      if (!context.sessionId) return fail('Sessão inválida.', 401)

      const { error } = await supabase.rpc('app_admin_terminate_session', {
        p_session_id: context.sessionId,
        p_target_session_id: body.targetSessionId,
      })

      if (error) return fail('Acesso negado.', 403)
      return NextResponse.json({ success: true })
    }

    if (action === 'admin_trust_device') {
      if (!context.sessionId) return fail('Sessão inválida.', 401)

      const { error } = await supabase.rpc('app_admin_trust_device', {
        p_session_id: context.sessionId,
        p_target_user_id: body.targetUserId,
        p_user_agent: body.userAgent || userAgent,
        p_ip: ip,
        p_environment: context.environment,
      })

      if (error) return fail('Acesso negado.', 403)
      return NextResponse.json({ success: true })
    }

    if (action === 'trusted_devices') {
      if (!context.sessionId) return fail('Sessão inválida.', 401)

      const { data, error } = await supabase.rpc('app_get_my_trusted_devices', {
        p_session_id: context.sessionId,
      })

      if (error) return fail('Sessão inválida.', 401)
      return NextResponse.json({ success: true, devices: data || [] })
    }

    if (action === 'remove_trusted_device') {
      if (!context.sessionId) return fail('Sessão inválida.', 401)

      const { error } = await supabase.rpc('app_remove_my_trusted_device', {
        p_session_id: context.sessionId,
        p_device_id: body.deviceId,
      })

      if (error) return fail('Não foi possível remover o dispositivo.', 400)
      return NextResponse.json({ success: true })
    }

    return fail('Ação inválida.')
  } catch {
    return fail('Erro interno de autenticação.', 500)
  }
}

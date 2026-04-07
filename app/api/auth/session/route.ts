import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { UAParser } from 'ua-parser-js'

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServer();
    const body = await request.json()
    console.log('Session API: Corpo da requisição:', JSON.stringify(body))
    const { userId, userAgent, action, sessionId, email, reason } = body

    // Get IP address
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown'

    if (action === 'check_rate_limit') {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z';
      const { data, error } = await supabase
        .from('login_attempts')
        .select('id')
        .eq('email', email)
        .gte('attempted_at', tenMinutesAgo)

      if (error) {
        // If table doesn't exist yet, just allow
        return NextResponse.json({ allowed: true })
      }

      if (data && data.length >= 5) {
        return NextResponse.json({ allowed: false, error: 'Muitas tentativas falhas. Tente novamente em 10 minutos.' })
      }

      return NextResponse.json({ allowed: true })
    }

    if (action === 'login_failed') {
      // Log failed attempt
      const { error } = await supabase
        .from('login_attempts')
        .insert([
          {
            email: email,
            ip_address: ip,
            user_agent: userAgent || request.headers.get('user-agent') || 'Unknown',
            reason: reason || 'Credenciais inválidas',
            attempted_at: new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z'
          }
        ])
      
      if (error) {
        console.error('Failed to log login attempt:', error)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'impersonate') {
      const { adminId, targetUserId } = body
      const { error } = await supabase
        .from('audit_logs')
        .insert([
          {
            user_id: Number(adminId),
            action: 'impersonate_user',
            entity: 'users',
            entity_id: Number(targetUserId),
            details: { target_user_id: Number(targetUserId), user_agent: userAgent || request.headers.get('user-agent') || 'Unknown', ip_address: ip },
          }
        ])
      
      if (error) {
        console.error('Failed to log impersonation:', error)
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'login') {
      console.log('Session API: Iniciando login para', userId)
      // 1. Prevent simultaneous logins (Logout other active sessions for this user)
      const nowISO = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z';
      await supabase
        .from('user_sessions')
        .update({ logout_at: nowISO })
        .eq('user_id', Number(userId))
        .is('logout_at', null)
      console.log('Session API: Sessões anteriores finalizadas')

      // 2. Parse User-Agent
      const uaString = userAgent || request.headers.get('user-agent') || 'Unknown'
      const parser = new UAParser(uaString)
      const browser = parser.getBrowser()
      const os = parser.getOS()
      const device = parser.getDevice()
      
      let readableUA = uaString
      if (browser.name && os.name) {
        readableUA = `${browser.name} no ${os.name}`
        if (device.type === 'mobile') readableUA += ' (Mobile)'
      }
      console.log('Session API: UA parseado')

      // 4. Check for Anomalous Access
      try {
        console.log('Session API: Verificando acesso anômalo')
        // First, check if this device is trusted
        const { data: trustedDevices } = await supabase
          .from('trusted_devices')
          .select('id')
          .eq('user_id', Number(userId))
          .eq('user_agent', readableUA)
          .limit(1);

        const isTrusted = trustedDevices && trustedDevices.length > 0;
        console.log('Session API: Acesso anômalo verificado, isTrusted:', isTrusted)

        if (!isTrusted) {
          const { data: previousSessions } = await supabase
            .from('user_sessions')
            .select('user_agent')
            .eq('user_id', Number(userId))
            .order('login_at', { ascending: false })
            .limit(10)

          if (previousSessions && previousSessions.length > 0) {
            const knownDevices = new Set(previousSessions.map((s: any) => s.user_agent))

            const isNewDevice = !knownDevices.has(readableUA)

            if (isNewDevice) {
              let alertMessage = 'Novo acesso detectado em sua conta.'
              alertMessage = `Acesso de um novo dispositivo (${readableUA}).`

              // Create notification
              await supabase.from('notifications').insert([{
                user_id: Number(userId),
                title: 'Alerta de Segurança',
                message: alertMessage,
                type: 'warning'
              }])
              console.log('Session API: Notificação de segurança criada')
            }
          }
        } else {
          // Update last_used_at for trusted device
          const nowISO = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z';
          await supabase
            .from('trusted_devices')
            .update({ last_used_at: nowISO })
            .eq('user_id', Number(userId))
            .eq('user_agent', readableUA);
          console.log('Session API: Dispositivo confiável atualizado')
        }
      } catch (e) {
        console.error('Anomalous Access Check Error:', e)
      }

      console.log('Session API: Inserindo nova sessão')
      const loginISO = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z';
      console.log('Session API: Inserindo nova sessão com dados:', {
        user_id: Number(userId),
        ip_address: ip,
        user_agent: readableUA,
        login_at: loginISO,
        last_seen_at: loginISO,
      })
      const { data, error } = await supabase
        .from('user_sessions')
        .insert([
          {
            user_id: Number(userId),
            organization_id: body.organizationId,
            ip_address: ip,
            user_agent: readableUA,
            login_at: loginISO,
            last_seen_at: loginISO,
          }
        ])
        .select('id')
        .single()

      if (error) {
        console.error('Session API: Erro ao inserir sessão:', JSON.stringify(error, null, 2))
        throw error
      }
      console.log('Session API: Sessão inserida com sucesso')

      // C. Correção Opcional (Tabela Genérica audit_logs):
      // Log successful login to the general audit_logs table
      try {
        await supabase.from('audit_logs').insert([{
          table_name: 'user_sessions',
          record_id: data.id,
          action: 'login',
          performed_by: Number(userId),
          new_data: {
            ip_address: ip,
            user_agent: readableUA,
            login_at: new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z'
          }
        }])
        console.log('Session API: Login registrado em audit_logs')
      } catch (auditError) {
        console.error('Session API: Erro ao registrar login em audit_logs:', auditError)
        // Don't fail the login if audit logging fails
      }

      return NextResponse.json({ success: true, sessionId: data.id })
    } 
    
    if (action === 'logout' && sessionId) {
      const nowISO = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z';
      const { error } = await supabase
        .from('user_sessions')
        .update({
          logout_at: nowISO,
          last_seen_at: nowISO
        })
        .eq('id', sessionId)

      if (error) throw error

      return NextResponse.json({ success: true })
    }

    if (action === 'heartbeat' && sessionId) {
      console.log('Session API: Heartbeat para sessão', sessionId)
      // Check if session is already terminated
      const { data: sessions, error: fetchError } = await supabase
        .from('user_sessions')
        .select('logout_at')
        .eq('id', sessionId);

      if (fetchError) {
        console.error('Session API: Erro ao buscar sessão no heartbeat:', fetchError)
        throw fetchError
      }

      if (!sessions || sessions.length === 0) {
        console.log('Session API: Sessão não encontrada')
        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 401 })
      }

      const session = sessions[0];

      if (session.logout_at) {
        console.log('Session API: Sessão terminada')
        return NextResponse.json({ success: false, error: 'Session terminated' }, { status: 401 })
      }

      const { error } = await supabase
        .from('user_sessions')
        .update({
          last_seen_at: new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z'
        })
        .eq('id', sessionId)

      if (error) {
        console.error('Session API: Erro ao atualizar heartbeat:', error)
        throw error
      }

      console.log('Session API: Heartbeat atualizado com sucesso')
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Session API Error:', JSON.stringify(error, null, 2))
    
    // Extract more details if it's a Supabase error
    const details = error?.message || error?.details || error?.hint || String(error)
    const code = error?.code || 'UNKNOWN'
    
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      code,
      details
    }, { status: 500 })
  }
}

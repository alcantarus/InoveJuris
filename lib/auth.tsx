'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppEnv } from './env'
import { setSessionToken } from './session-token'

const AUTH_ENDPOINT = '/api/auth/session'
const USER_KEY = 'inovejuris_user'
const ACTIVITY_KEY = 'session_last_activity'
const SESSION_MARKER = 'inovejuris_browser_session_open'
// Uma aba recém-aberta dentro da mesma sessão do navegador pode não ter o
// marker; 2 minutos evitam que uma sessão restaurada após fechar o navegador
// volte automaticamente, sem atrapalhar a troca normal de abas.
const REOPEN_GAP_MS = 2 * 60 * 1000

export interface User {
  id: number
  name: string
  email: string
  role_name?: string
  canAccessClients: boolean
  canAccessProcesses: boolean
  canAccessPrazos: boolean
  canAccessCalendario: boolean
  canAccessPublicacoes: boolean
  canAccessContracts: boolean
  canAccessCashFlow: boolean
  canAccessReceivables: boolean
  canAccessProducts: boolean
  canAccessIndicators: boolean
  canAccessReports: boolean
  canAccessUsers: boolean
  canAccessSettings: boolean
  canAccessAudit: boolean
  canAccessLawyers: boolean
  canAccessDocuments: boolean
  canAccessDocTemplates: boolean
  canAccessDocGeneration: boolean
  canAccessLeads: boolean
  canAccessDashboard: boolean
  canAccessProdEnv: boolean
  canAccessTestEnv: boolean
  is_superadmin: boolean
  expiration_date?: string
  selectedEnv?: AppEnv
  environment?: AppEnv
  sessionId?: string
}

type AuthResponse = {
  success?: boolean
  valid?: boolean
  user?: any
  challenge?: string
  error?: string
  token?: string
  token_expires_at?: number
}

async function postAuth(action: string, payload: Record<string, unknown> = {}): Promise<AuthResponse> {
  const response = await fetch(AUTH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.error || 'Falha de comunicação com o servidor de autenticação.')
  }

  return data
}

function clearLocalSession() {
  setSessionToken(null)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(ACTIVITY_KEY)
  sessionStorage.removeItem(SESSION_MARKER)
}

function storeAuthenticatedUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  localStorage.setItem(ACTIVITY_KEY, Date.now().toString())
  sessionStorage.setItem(SESSION_MARKER, '1')
}

function withEnvironment(user: any, environment: AppEnv): User {
  return { ...user, selectedEnv: environment, environment }
}

// Links públicos usam o token da URL (header x-inove-access-token), não a
// sessão do painel. O middleware já os isenta; o bootstrap do useAuth precisa
// fazer o mesmo, senão SessionMonitor/LeadsButton (layout raiz) redirecionam
// o indicador para /login.
const PUBLIC_LINK_ROUTE = /^\/(?:onboarding|portal\/indicador)\/[^/]+\/?$/

function isPublicLinkRoute(pathname: string) {
  return PUBLIC_LINK_ROUTE.test(pathname)
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const data = await postAuth('validate')
      if (!data.valid || !data.user) {
        clearLocalSession()
        setUser(null)
        return
      }
      const nextUser = withEnvironment(data.user, data.user.environment || 'production')
      setSessionToken(data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
      setUser(nextUser)
    } catch {
      // A validação de bootstrap já trata falhas de rede.
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      // A tela de login não precisa restaurar sessão; se houver cookies válidos,
      // a validação ocorre no primeiro acesso autenticado.
      const pathname = window.location.pathname
      if (pathname === '/login') {
        clearLocalSession()
        if (!cancelled) setLoading(false)
        return
      }

      // Onboarding e portal do indicador são públicos. Não limpar a sessão
      // local aqui: o administrador pode abrir o link em outra aba e voltar
      // ao painel sem precisar logar de novo.
      if (isPublicLinkRoute(pathname)) {
        if (!cancelled) setLoading(false)
        return
      }

      try {
        const data = await postAuth('validate')

        if (!data.valid || !data.user) {
          clearLocalSession()
          window.location.replace('/login')
          return
        }

        const lastActivity = Number(localStorage.getItem(ACTIVITY_KEY) || 0)
        const hasBrowserMarker = sessionStorage.getItem(SESSION_MARKER) === '1'
        const gap = Date.now() - lastActivity

        if (!hasBrowserMarker && gap > REOPEN_GAP_MS) {
          await postAuth('logout').catch(() => undefined)
          clearLocalSession()
          window.location.replace('/login?reason=session')
          return
        }

        sessionStorage.setItem(SESSION_MARKER, '1')
        localStorage.setItem(ACTIVITY_KEY, Date.now().toString())
        setSessionToken(data.token)
        if (!cancelled) setUser(withEnvironment(data.user, data.user.environment || 'production'))
      } catch {
        clearLocalSession()
        window.location.replace('/login')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    bootstrap()
    return () => { cancelled = true }
  }, [])

  const validateCredentials = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: any; challenge?: string; error?: string }> => {
    try {
      const data = await postAuth('authenticate', { email, password })
      if (!data.success || !data.user || !data.challenge) {
        return { success: false, error: data.error || 'E-mail ou senha inválidos.' }
      }
      return { success: true, user: data.user, challenge: data.challenge }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Não foi possível validar as credenciais.' }
    }
  }

  const login = async (
    userFromAuth: any,
    selectedEnv: AppEnv,
    challenge: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (selectedEnv === 'production' && userFromAuth.canAccessProdEnv === false) {
        return { success: false, error: 'Você não tem permissão para acessar o Ambiente de Produção.' }
      }
      if (selectedEnv === 'test' && !userFromAuth.canAccessTestEnv) {
        return { success: false, error: 'Você não tem permissão para acessar o Ambiente de Teste.' }
      }

      const data = await postAuth('login', { challenge, environment: selectedEnv })

      if (!data.success || !data.user) {
        return { success: false, error: data.error || 'Erro ao registrar sessão de acesso.' }
      }

      const nextUser = withEnvironment(data.user, selectedEnv)
      setSessionToken(data.token)
      storeAuthenticatedUser(nextUser)
      setUser(nextUser)
      window.location.assign('/')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao conectar ao servidor de sessão.' }
    }
  }

  const logout = async () => {
    try {
      await postAuth('logout')
    } catch {
      // Mesmo se o servidor falhar, remove o estado local e os cookies
      // de sessão são apagados pela rota quando possível.
    } finally {
      clearLocalSession()
      setUser(null)
      window.location.assign('/login')
    }
  }

  const impersonate = async (
    targetUserId: number,
    selectedEnv: AppEnv
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const data = await postAuth('impersonate', { targetUserId })

      if (!data.success || !data.user || !data.challenge) {
        return { success: false, error: data.error || 'Não foi possível assumir este usuário.' }
      }

      return await login(data.user, selectedEnv, data.challenge)
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao acessar como usuário.' }
    }
  }

  const switchEnvironment = async (newEnv: AppEnv): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Usuário não autenticado.' }

    if (newEnv === 'production' && user.canAccessProdEnv === false) {
      return { success: false, error: 'Você não tem permissão para acessar o Ambiente de Produção.' }
    }
    if (newEnv === 'test' && !user.canAccessTestEnv) {
      return { success: false, error: 'Você não tem permissão para acessar o Ambiente de Teste.' }
    }

    try {
      const data = await postAuth('switch_environment', { environment: newEnv })
      if (!data.success) {
        return { success: false, error: data.error || 'Erro ao trocar de ambiente.' }
      }

      const updatedUser = withEnvironment(user, newEnv)
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser))
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString())
      sessionStorage.setItem(SESSION_MARKER, '1')
      setUser(updatedUser)
      window.location.reload()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao trocar de ambiente.' }
    }
  }

  return { user, loading, validateCredentials, login, logout, refreshUser, impersonate, switchEnvironment }
}

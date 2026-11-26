// Token de sessão do Supabase (F4b-2b / Fase A).
//
// O token NUNCA vai para localStorage. Ele fica em memória e, no navegador,
// também em sessionStorage: isso cobre o recarregamento da mesma aba e evita
// que a primeira consulta de cada tela saia como anon antes do bootstrap do
// useAuth() terminar. Ao fechar a aba, o sessionStorage some; logout chama
// setSessionToken(null) e remove a cópia.

const STORAGE_KEY = 'inovejuris_session_token'

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY)
    return value && value.trim() ? value : null
  } catch {
    return null
  }
}

let currentToken: string | null = readStoredToken()
let portalAccessToken: string | null = null

/** Token de link público (onboarding/portal). Nunca persistido. */
export function setAccessToken(token: string | null | undefined) {
  portalAccessToken = typeof token === 'string' && token.trim() ? token : null
}

export function getAccessToken(): string | null {
  return portalAccessToken
}

export function setSessionToken(token: string | null | undefined) {
  currentToken = typeof token === 'string' && token.trim() ? token : null

  if (typeof window === 'undefined') return
  try {
    if (currentToken) window.sessionStorage.setItem(STORAGE_KEY, currentToken)
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // sessionStorage bloqueado: o token continua disponível em memória.
  }
}

export function getSessionToken(): string | null {
  return currentToken
}

/** organization_id assinado no JWT de sessao; nunca vem de origem do cliente. */
export function getSessionOrganizationId(): string | null {
  const token = getSessionToken()
  if (!token) return null

  try {
    const parts = token.split('.')
    if (parts.length < 2) return null

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    const value = payload?.organization_id

    return typeof value === 'string' && value.trim() !== '' ? value : null
  } catch {
    return null
  }
}

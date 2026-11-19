import { SignJWT, importJWK } from 'jose'

/**
 * Emissão do token de sessão (F4b-2b / Fase A).
 *
 * A chave privada vem de `SUPABASE_JWT_PRIVATE_JWK` (JWK em JSON, ES256),
 * lida apenas no servidor. Sem a variável, nada é emitido e o sistema segue
 * exatamente como antes — por isso a Fase A pode ser publicada antes da chave
 * existir.
 *
 * Claims: role, session_id, environment, organization_id e sub. Na Fase A o
 * `role` é `anon` (mesmo privilégio de hoje). Na Fase B passa a `authenticated`
 * quando as policies já souberem ler as claims.
 */

const ALG = 'ES256'
const DEFAULT_TTL_SECONDS = 600
const PREFLIGHT_OK_TTL_MS = 10 * 60 * 1000
const PREFLIGHT_FAIL_TTL_MS = 60 * 1000

type Jwk = Parameters<typeof importJWK>[0]

let cachedKey: Awaited<ReturnType<typeof importJWK>> | null = null
let cachedRaw: string | null = null
let cachedKid: string | undefined
let missingKeyWarned = false

// Trava de segurança: um token só chega ao navegador depois que o próprio
// PostgREST confirma que o aceita. Se a chave estiver errada, o app continua
// funcionando exatamente como hoje (sem token) em vez de quebrar.
let preflightOkAt = 0
let preflightFailedAt = 0

async function tokenAcceptedByPostgrest(token: string): Promise<boolean> {
  const now = Date.now()
  if (preflightOkAt && now - preflightOkAt < PREFLIGHT_OK_TTL_MS) return true
  if (preflightFailedAt && now - preflightFailedAt < PREFLIGHT_FAIL_TTL_MS) return false

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    preflightFailedAt = now
    console.error('[jwt] Preflight impossível: URL ou chave pública ausente.')
    return false
  }

  try {
    const response = await fetch(`${url}/rest/v1/system_settings?select=key&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (response.ok) {
      preflightOkAt = now
      preflightFailedAt = 0
      return true
    }

    preflightFailedAt = now
    const detail = (await response.text()).slice(0, 200)
    console.error('[jwt] PostgREST recusou o token:', response.status, detail)
    return false
  } catch (error) {
    preflightFailedAt = now
    console.error('[jwt] Preflight do token falhou:', error)
    return false
  }
}

export function isTokenSigningConfigured(): boolean {
  return Boolean(process.env.SUPABASE_JWT_PRIVATE_JWK?.trim())
}

function tokenRole(): 'anon' | 'authenticated' {
  return process.env.SUPABASE_JWT_ROLE === 'authenticated' ? 'authenticated' : 'anon'
}

async function getSigningKey(): Promise<{ key: Awaited<ReturnType<typeof importJWK>>; kid?: string } | null> {
  const raw = process.env.SUPABASE_JWT_PRIVATE_JWK?.trim()
  if (!raw) {
    if (!missingKeyWarned) {
      missingKeyWarned = true
      console.warn('[jwt] SUPABASE_JWT_PRIVATE_JWK ausente: sessão segue sem token.')
    }
    return null
  }

  const configuredKid = process.env.SUPABASE_JWT_KID?.trim()

  if (cachedKey && cachedRaw === raw) {
    return { key: cachedKey, kid: configuredKid || cachedKid }
  }

  const jwk = JSON.parse(raw) as Jwk
  cachedKey = await importJWK(jwk, ALG)
  cachedRaw = raw
  cachedKid = typeof (jwk as any).kid === 'string' ? (jwk as any).kid : undefined
  return { key: cachedKey, kid: configuredKid || cachedKid }
}

export interface SessionClaims {
  userId: number | string
  sessionId: string
  environment: string
  organizationId?: string | null
}

export interface SignedSessionToken {
  token: string
  expiresAt: number
}

export async function signSessionToken(
  claims: SessionClaims
): Promise<SignedSessionToken | null> {
  const signing = await getSigningKey()
  if (!signing) return null

  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + DEFAULT_TTL_SECONDS

  const payload: Record<string, unknown> = {
    role: tokenRole(),
    session_id: claims.sessionId,
    environment: claims.environment,
  }
  if (claims.organizationId) payload.organization_id = claims.organizationId

  const token = await new SignJWT(payload)
    .setProtectedHeader(signing.kid ? { alg: ALG, kid: signing.kid } : { alg: ALG })
    .setSubject(String(claims.userId))
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(signing.key)

  if (!(await tokenAcceptedByPostgrest(token))) return null

  return { token, expiresAt }
}

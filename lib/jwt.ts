import { SignJWT, importJWK } from 'jose'

/**
 * Emissão do token de sessão (F4b-2b / Fase A).
 *
 * A chave privada vem de `SUPABASE_JWT_PRIVATE_JWK` (JWK em JSON, ES256),
 * lida apenas no servidor. Sem a variável, nada é emitido e o sistema segue
 * exatamente como antes — por isso a Fase A pode ser publicada antes da chave
 * existir.
 *
 * Claims: role, session_id, environment, is_superadmin, organization_id e sub.
 * O `role` é configurável por SUPABASE_JWT_ROLE; as policies do Bloco 3 cobrem
 * tanto `anon` quanto `authenticated`.
 */

const ALG = 'ES256'
const DEFAULT_TTL_SECONDS = 600
const PREFLIGHT_OK_TTL_MS = 10 * 60 * 1000
const PREFLIGHT_FAIL_TTL_MS = 60 * 1000

type Jwk = Parameters<typeof importJWK>[0]

let cachedKey: Awaited<ReturnType<typeof importJWK>> | null = null
let cachedRaw: string | null = null
let cachedKid: string | undefined
let cachedHmacKey: Uint8Array | null = null
let cachedHmacSecret: string | null = null
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
  return Boolean(
    process.env.SUPABASE_JWT_PRIVATE_JWK?.trim() || process.env.SUPABASE_JWT_SECRET?.trim()
  )
}

function tokenRole(): 'anon' | 'authenticated' {
  return process.env.SUPABASE_JWT_ROLE === 'authenticated' ? 'authenticated' : 'anon'
}

type SigningMaterial =
  | { alg: 'ES256'; key: Awaited<ReturnType<typeof importJWK>>; kid?: string }
  | { alg: 'HS256'; key: Uint8Array }

async function getSigningMaterial(): Promise<SigningMaterial | null> {
  const rawJwk = process.env.SUPABASE_JWT_PRIVATE_JWK?.trim()

  if (rawJwk) {
    const configuredKid = process.env.SUPABASE_JWT_KID?.trim()

    if (cachedKey && cachedRaw === rawJwk) {
      return { alg: 'ES256', key: cachedKey, kid: configuredKid || cachedKid }
    }

    const jwk = JSON.parse(rawJwk) as Jwk
    cachedKey = await importJWK(jwk, ALG)
    cachedRaw = rawJwk
    cachedKid = typeof (jwk as any).kid === 'string' ? (jwk as any).kid : undefined
    return { alg: 'ES256', key: cachedKey, kid: configuredKid || cachedKid }
  }

  // Alternativa: segredo compartilhado legado (HS256), ainda aceito pelo
  // PostgREST enquanto a chave antiga constar em "Previously used keys".
  const secret = process.env.SUPABASE_JWT_SECRET?.trim()
  if (secret) {
    if (!cachedHmacKey || cachedHmacSecret !== secret) {
      cachedHmacKey = new TextEncoder().encode(secret)
      cachedHmacSecret = secret
    }
    return { alg: 'HS256', key: cachedHmacKey }
  }

  if (!missingKeyWarned) {
    missingKeyWarned = true
    console.warn('[jwt] Sem chave de assinatura configurada: sessão segue sem token.')
  }
  return null
}

export interface SessionClaims {
  userId: number | string
  sessionId: string
  environment: string
  isSuperadmin?: boolean
  organizationId?: string | null
}

export interface SignedSessionToken {
  token: string
  expiresAt: number
}

export async function signSessionToken(
  claims: SessionClaims
): Promise<SignedSessionToken | null> {
  const signing = await getSigningMaterial()
  if (!signing) return null

  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + DEFAULT_TTL_SECONDS

  const payload: Record<string, unknown> = {
    role: tokenRole(),
    session_id: claims.sessionId,
    environment: claims.environment,
    is_superadmin: claims.isSuperadmin === true,
  }
  if (claims.organizationId) payload.organization_id = claims.organizationId

  const header =
    signing.alg === 'ES256'
      ? signing.kid
        ? { alg: 'ES256' as const, kid: signing.kid }
        : { alg: 'ES256' as const }
      : { alg: 'HS256' as const }

  const token = await new SignJWT(payload)
    .setProtectedHeader(header)
    .setSubject(String(claims.userId))
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(signing.key)

  if (!(await tokenAcceptedByPostgrest(token))) return null

  return { token, expiresAt }
}

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

type Jwk = Parameters<typeof importJWK>[0]

let cachedKey: Awaited<ReturnType<typeof importJWK>> | null = null
let cachedRaw: string | null = null
let missingKeyWarned = false

export function isTokenSigningConfigured(): boolean {
  return Boolean(process.env.SUPABASE_JWT_PRIVATE_JWK?.trim())
}

function tokenRole(): 'anon' | 'authenticated' {
  return process.env.SUPABASE_JWT_ROLE === 'authenticated' ? 'authenticated' : 'anon'
}

async function getSigningKey() {
  const raw = process.env.SUPABASE_JWT_PRIVATE_JWK?.trim()
  if (!raw) {
    if (!missingKeyWarned) {
      missingKeyWarned = true
      console.warn('[jwt] SUPABASE_JWT_PRIVATE_JWK ausente: sessão segue sem token.')
    }
    return null
  }

  if (cachedKey && cachedRaw === raw) return cachedKey

  const jwk = JSON.parse(raw) as Jwk
  cachedKey = await importJWK(jwk, ALG)
  cachedRaw = raw
  return cachedKey
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
  const key = await getSigningKey()
  if (!key) return null

  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + DEFAULT_TTL_SECONDS

  const payload: Record<string, unknown> = {
    role: tokenRole(),
    session_id: claims.sessionId,
    environment: claims.environment,
  }
  if (claims.organizationId) payload.organization_id = claims.organizationId

  const kid = process.env.SUPABASE_JWT_KID?.trim()
  const token = await new SignJWT(payload)
    .setProtectedHeader(kid ? { alg: ALG, kid } : { alg: ALG })
    .setSubject(String(claims.userId))
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(key)

  return { token, expiresAt }
}

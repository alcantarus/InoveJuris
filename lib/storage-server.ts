import { createClient } from '@supabase/supabase-js'
import { defaultUrlProd } from '@/lib/supabase'

export const STORAGE_BUCKETS = ['client_documents', 'templates', 'marketing'] as const
export type StorageBucket = (typeof STORAGE_BUCKETS)[number]

export class StorageConfigError extends Error {
  constructor(message = 'Armazenamento não configurado no servidor.') {
    super(message)
    this.name = 'StorageConfigError'
  }
}

export function isStorageBucket(value: unknown): value is StorageBucket {
  return typeof value === 'string' && (STORAGE_BUCKETS as readonly string[]).includes(value)
}

/**
 * A service role so existe no servidor. Nao ha fallback para NEXT_PUBLIC_*:
 * uma chave publicada no bundle nao pode ser usada para gerar URLs assinadas
 * de buckets privados.
 */
export function getStorageServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!key || !key.trim()) {
    throw new StorageConfigError(
      'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.'
    )
  }

  return createClient(defaultUrlProd, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function isValidStoragePath(path: string): boolean {
  if (!path || path.length > 500) return false
  if (path.startsWith('/') || path.endsWith('/')) return false
  if (path.includes('..') || path.includes('\\')) return false
  if (path.includes('?') || path.includes('#') || path.includes('\0')) return false
  return true
}

function decodePath(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** Extrai o caminho relativo de uma URL publica/signada do Supabase Storage. */
export function storagePathFromUrl(url: string, bucket: StorageBucket): string | null {
  try {
    const parsed = new URL(url)
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
    ]

    for (const marker of markers) {
      const index = parsed.pathname.indexOf(marker)
      if (index >= 0) {
        const path = decodePath(parsed.pathname.slice(index + marker.length))
        return isValidStoragePath(path) ? path : null
      }
    }
  } catch {
    // URL externa ou malformada: nao e objeto deste bucket.
  }

  return null
}

export function normalizeStoragePath(
  input: unknown,
  bucket?: StorageBucket
): string | null {
  if (typeof input !== 'string') return null

  const trimmed = input.trim()
  if (!trimmed) return null

  if (bucket) {
    const fromUrl = storagePathFromUrl(trimmed, bucket)
    if (fromUrl) return fromUrl
  }

  return isValidStoragePath(trimmed) ? trimmed : null
}

/**
 * Nao geramos mais URLs publicas. Buckets sao privados e o acesso passa por
 * /api/storage/signed-url, que valida a sessao antes de assinar o arquivo.
 */

export const STORAGE_BUCKETS = ['client_documents', 'templates', 'marketing'] as const
export type StorageBucket = (typeof STORAGE_BUCKETS)[number]

function isBucket(value: string): value is StorageBucket {
  return (STORAGE_BUCKETS as readonly string[]).includes(value)
}

function decodePath(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** Caminhos relativos sao o formato gravado apos remover as URLs publicas. */
function isRelativeStoragePath(value: string): boolean {
  if (!value || value.length > 500) return false
  if (value.startsWith('/') || value.endsWith('/') || value.includes('//')) return false
  if (value.includes('..') || value.includes('\\')) return false
  if (/[?#\0]/.test(value)) return false
  // URL absoluta ou outro esquema (http:, data:, ...) nao e um path.
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false
  return true
}

/** Extrai o path de URLs antigas ou do path relativo gravado no banco. */
export function storagePathFromUrl(
  input: string,
  bucket: StorageBucket
): string | null {
  const raw = input.trim()
  if (!raw) return null

  try {
    const parsed = new URL(raw)
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
    ]

    for (const marker of markers) {
      const index = parsed.pathname.indexOf(marker)
      if (index >= 0) {
        const path = decodePath(parsed.pathname.slice(index + marker.length))
        if (path && !path.includes('..') && !path.startsWith('/')) return path
      }
    }
  } catch {
    // Nao e uma URL absoluta: pode ser um path relativo.
  }

  if (!isRelativeStoragePath(raw)) return null
  const decoded = decodePath(raw)
  return isRelativeStoragePath(decoded) ? decoded : null
}

/**
 * Converte uma URL publica antiga em uma URL do nosso servidor, que valida a
 * sessao e redireciona para uma URL assinada. URLs externas (ex.: fallback de
 * imagem) passam sem alteracao.
 */
export function storageUrl(input: string, bucket: StorageBucket): string {
  const path = storagePathFromUrl(input, bucket)
  if (!path) return input

  return `/api/storage/signed-url?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}&redirect=1`
}

export type UploadResult = {
  bucket: StorageBucket
  path: string
}

export async function uploadStorageFile(
  bucket: StorageBucket,
  file: File,
  options: { path?: string; clientId?: string } = {}
): Promise<UploadResult> {
  const form = new FormData()
  form.append('bucket', bucket)
  form.append('file', file)

  if (options.path) form.append('path', options.path)
  if (options.clientId) form.append('clientId', options.clientId)

  const response = await fetch('/api/storage/upload', {
    method: 'POST',
    body: form,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.error || 'Falha ao enviar o arquivo.')
  }

  return data as UploadResult
}

export async function removeStorageFile(
  bucket: StorageBucket,
  pathOrUrl: string
): Promise<void> {
  const path = storagePathFromUrl(pathOrUrl, bucket) || pathOrUrl

  const response = await fetch('/api/storage/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.error || 'Falha ao remover o arquivo.')
  }
}

export { isBucket }

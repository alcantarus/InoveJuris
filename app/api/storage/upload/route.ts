import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { AdminAuthError } from '@/lib/server-auth'
import { authorizeStoragePath } from '@/lib/storage-policy'
import {
  isStorageBucket,
  normalizeStoragePath,
  getStorageServiceClient,
  StorageConfigError,
} from '@/lib/storage-server'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function safeExtension(name: string): string {
  const parts = name.split('.')
  if (parts.length < 2) return ''
  const ext = parts.pop() || ''
  return /^[a-zA-Z0-9]{1,8}$/.test(ext) ? `.${ext}` : ''
}

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof StorageConfigError) {
    return NextResponse.json({ error: error.message }, { status: 503 })
  }
  console.error('[storage/upload]', error)
  return NextResponse.json({ error: 'Falha interna no upload.' }, { status: 500 })
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const bucketRaw = form.get('bucket')

    if (!isStorageBucket(bucketRaw)) {
      throw new AdminAuthError('Bucket inválido.', 400)
    }
    const bucket = bucketRaw

    const file = form.get('file')
    if (!(file instanceof File)) {
      throw new AdminAuthError('Arquivo não enviado.', 400)
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new AdminAuthError('Arquivo excede o limite de 10 MB.', 400)
    }

    let path = normalizeStoragePath(form.get('path'), bucket)

    if (bucket === 'client_documents') {
      const clientIdRaw = form.get('clientId')
      if (typeof clientIdRaw !== 'string' || !clientIdRaw.trim()) {
        throw new AdminAuthError('Cliente não informado.', 400)
      }
      const clientId = clientIdRaw.trim()
      const fileName = path || `${randomUUID()}${safeExtension(file.name)}`
      path = fileName.startsWith(`${clientId}/`) ? fileName : `${clientId}/${fileName}`
    } else if (!path) {
      path = `${Date.now()}_${randomUUID()}${safeExtension(file.name)}`
    }

    await authorizeStoragePath(bucket, path, 'write')

    const client = getStorageServiceClient()
    const { error } = await client.storage.from(bucket).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    })

    if (error) throw new Error(error.message)

    return NextResponse.json({ bucket, path })
  } catch (error) {
    return errorResponse(error)
  }
}

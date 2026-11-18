import { NextResponse } from 'next/server'
import { AdminAuthError } from '@/lib/server-auth'
import { authorizeStoragePath } from '@/lib/storage-policy'
import {
  isStorageBucket,
  normalizeStoragePath,
  getStorageServiceClient,
  StorageConfigError,
} from '@/lib/storage-server'

export const runtime = 'nodejs'

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof StorageConfigError) {
    return NextResponse.json({ error: error.message }, { status: 503 })
  }
  console.error('[storage/remove]', error)
  return NextResponse.json({ error: 'Falha ao remover o arquivo.' }, { status: 500 })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    if (!isStorageBucket(body?.bucket)) {
      throw new AdminAuthError('Bucket inválido.', 400)
    }
    const bucket = body.bucket

    const path = normalizeStoragePath(body?.path ?? body?.url, bucket)
    if (!path) {
      throw new AdminAuthError('Caminho inválido.', 400)
    }

    await authorizeStoragePath(bucket, path, 'write')

    const client = getStorageServiceClient()
    const { error } = await client.storage.from(bucket).remove([path])

    if (error) throw new Error(error.message)

    return NextResponse.json({ removed: true, bucket, path })
  } catch (error) {
    return errorResponse(error)
  }
}

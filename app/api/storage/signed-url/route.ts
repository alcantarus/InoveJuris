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

const EXPIRES_IN_SECONDS = 60 * 60

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof StorageConfigError) {
    return NextResponse.json({ error: error.message }, { status: 503 })
  }
  console.error('[storage/signed-url]', error)
  return NextResponse.json({ error: 'Falha ao gerar URL assinada.' }, { status: 500 })
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const bucketRaw = url.searchParams.get('bucket')

    if (!isStorageBucket(bucketRaw)) {
      throw new AdminAuthError('Bucket inválido.', 400)
    }
    const bucket = bucketRaw

    const path = normalizeStoragePath(
      url.searchParams.get('path') ?? url.searchParams.get('url'),
      bucket
    )

    if (!path) {
      throw new AdminAuthError('Caminho inválido.', 400)
    }

    await authorizeStoragePath(bucket, path, 'read')

    const client = getStorageServiceClient()
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(path, EXPIRES_IN_SECONDS)

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || 'URL assinada não retornada.')
    }

    if (url.searchParams.get('redirect') === '1') {
      // A URL assinada expira; nunca deixar um proxy ou o navegador guardar
      // uma resposta de redirecionamento com a localização antiga.
      return NextResponse.redirect(data.signedUrl, {
        status: 302,
        headers: { 'Cache-Control': 'private, no-store' },
      })
    }

    // Cache somente no navegador (private) e por pouco tempo: evita gerar
    // outra assinatura em navegações repetidas sem arriscar URL expirada em
    // cache compartilhado.
    return NextResponse.json({
      bucket,
      path,
      signedUrl: data.signedUrl,
      expiresIn: EXPIRES_IN_SECONDS,
    }, {
      headers: { 'Cache-Control': 'private, max-age=300, must-revalidate' },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

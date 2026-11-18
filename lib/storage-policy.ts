import { AdminAuthError, requireSessionContext, type SessionContext } from '@/lib/server-auth'
import { getStorageServiceClient, type StorageBucket } from '@/lib/storage-server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function hasBucketPermission(
  user: Record<string, any>,
  bucket: StorageBucket,
  mode: 'read' | 'write'
): boolean {
  if (user.is_superadmin === true) return true

  switch (bucket) {
    case 'client_documents':
      return user.canAccessClients === true
    case 'templates':
      return (
        user.canAccessDocTemplates === true ||
        (mode === 'read' && user.canAccessDocGeneration === true)
      )
    case 'marketing':
      return user.canAccessSettings === true
    default:
      return false
  }
}

/**
 * Valida a sessao e a permissao do modulo antes de qualquer operacao de storage.
 * Para documentos de cliente, exige que o primeiro segmento do caminho seja um
 * cliente do ambiente da sessao — nao confia apenas no path enviado pelo cliente.
 */
export async function authorizeStoragePath(
  bucket: StorageBucket,
  path: string,
  mode: 'read' | 'write'
): Promise<SessionContext> {
  const ctx = await requireSessionContext()

  if (!hasBucketPermission(ctx.user, bucket, mode)) {
    throw new AdminAuthError('Acesso negado.', 403)
  }

  if (bucket === 'client_documents') {
    const clientId = path.split('/')[0]

    if (!UUID_RE.test(clientId)) {
      throw new AdminAuthError('Caminho de documento inválido.', 400)
    }

    const client = getStorageServiceClient()
    const { data, error } = await client
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('environment', ctx.environment)
      .limit(1)

    if (error || !data || data.length === 0) {
      throw new AdminAuthError('Cliente não encontrado neste ambiente.', 404)
    }
  }

  return ctx
}

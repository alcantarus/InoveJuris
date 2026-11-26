// Resolucao do tenant da sessao.
//
// Regra adotada em 26/11/2026, alinhada ao trigger `trg_fill_organization_id`:
//   - production -> organizacao do usuario;
//   - test       -> organizacao demo (is_demo = true), compartilhada por quem
//                   tiver canAccessTestEnv.
//
// Nunca aceita organization_id enviada pelo cliente.

function normalize(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

/**
 * Retorna a organizacao que deve assinar o JWT e preencher o contexto de
 * servidor. `client` deve ser service_role: esta funcao nao roda no navegador.
 */
export async function resolveOrganizationId(
  client: any,
  environment: string,
  user: any
): Promise<string | null> {
  if (environment === 'test') {
    const { data, error } = await client
      .from('organizations')
      .select('id')
      .eq('is_demo', true)
      .maybeSingle()

    if (error) {
      console.warn('[tenant] Nao foi possivel ler a organizacao demo:', error.message)
    } else {
      const demo = normalize(data?.id)
      if (demo) return demo
    }
  }

  let organizationId = normalize(user?.organization_id)

  if (!organizationId && user?.id != null) {
    const { data: userRow, error: userError } = await client
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle()

    if (userError) {
      console.warn('[tenant] Nao foi possivel ler organization_id do usuario:', userError.message)
    } else {
      organizationId = normalize(userRow?.organization_id)
    }
  }

  return organizationId
}

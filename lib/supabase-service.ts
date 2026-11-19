import { createClient } from '@supabase/supabase-js'
import { defaultUrlProd } from './supabase'

/**
 * Erro explicito para falta de configuracao. Diferente das rotas legadas,
 * nao caímos para a chave anon em silencio: uma rota que exige service_role
 * deve falhar alto, nao gravar com privilegio menor e mascarar o problema.
 */
export class ServiceRoleConfigError extends Error {
  constructor() {
    super('SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor.')
    this.name = 'ServiceRoleConfigError'
  }
}

/**
 * Somente SUPABASE_SERVICE_ROLE_KEY.
 *
 * Nao lemos NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY de proposito: variaveis
 * NEXT_PUBLIC_* sao embutidas no bundle do navegador quando referenciadas no
 * cliente, e uma service_role no bundle daria acesso total ao banco a
 * qualquer visitante.
 */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!key) {
    throw new ServiceRoleConfigError()
  }

  return key
}

/**
 * Cliente com service_role. Exclusivo para rotas de servidor.
 */
export function createServiceRoleClient() {
  return createClient(defaultUrlProd, getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

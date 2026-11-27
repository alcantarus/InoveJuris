import { createClient } from '@supabase/supabase-js'
import { getAppEnv } from './env'
import { getAccessToken, getSessionOrganizationId, getSessionToken } from './session-token'

// Helper to ensure URL is valid or fallback
const getValidUrl = (url: string | undefined, fallback: string, name: string) => {
  if (url && url.trim() !== '') {
    try {
      new URL(url);
      return url;
    } catch (e) {
      console.error(`[Supabase] Variável de ambiente ${name} inválida: ${url}. Usando fallback.`);
    }
  }
  return fallback;
}

// Credenciais de producao lidas das variaveis de ambiente.
// Nenhuma chave fica fixa no codigo: a chave antiga foi desativada no Supabase.
export const defaultUrlProd = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jhlxzqsgmudkbjkynqdl.supabase.co"
export const defaultKeyProd = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// We now ONLY use the Production database for both environments (Logical Isolation)
const clients = new Map<string, any>();

// Somente estas tabelas possuem a coluna organization_id (medido em 26/11/2026).
// Fora desta lista o Proxy nao injeta o filtro, para nao quebrar consultas.
const TABELAS_COM_ORGANIZATION_ID = new Set<string>([
  'bank_accounts',
  'birthday_messages',
  'birthday_templates',
  'client_documents',
  'client_interactions',
  'client_onboarding_tokens',
  'client_tags',
  'clients',
  'commission_payments',
  'contracts',
  'document_templates',
  'financial_categories',
  'financial_transactions',
  'indicator_tokens',
  'indicators',
  'installments',
  'kanban_boards',
  'kanban_columns',
  'law_areas',
  'lawyers',
  'legal_contract_workflow',
  'legal_contracts',
  'login_attempts',
  'marketing_logs',
  'notifications',
  'payments',
  'process_deadlines',
  'processes',
  'products',
  'role_permissions',
  'roles',
  'system_settings',
  'tasks',
  'template_variables',
  'trusted_devices',
  'user_roles',
  'user_sessions',
  'users',
]);

// Token de sessão (F4b-2b / Fase A). Sem token, a requisição sai como hoje.
// Com token, o Bearer da chave publicável é substituído pelo JWT de sessão.
const sessionAwareFetch: typeof fetch = (input, init) => {
  const sessionToken = typeof window === 'undefined' ? null : getSessionToken()
  const accessToken = typeof window === 'undefined' ? null : getAccessToken()

  // Links públicos (onboarding/portal do indicador) não têm sessão, mas
  // precisam enviar o token da URL. Sair cedo quando não há sessão apagava
  // esse header e fazia o PostgREST enxergar tudo como anon.
  if (!sessionToken && !accessToken) return fetch(input as any, init)

  const headers = new Headers(init?.headers)
  // O supabase-js preenche Authorization com a chave publicável ANTES de chamar
  // este fetch. Quando há token de sessão, ele deve substituir esse Bearer —
  // caso contrário a requisição chega ao PostgREST como anon.
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`)

  // O header é lido por RLS para limitar o acesso ao registro dono do token.
  if (accessToken) headers.set('x-inove-access-token', accessToken)

  return fetch(input as any, { ...init, headers })
}

// O canal Realtime precisa receber o token explicitamente.
const realtimeTokens = new Map<string, string>()

const applyRealtimeToken = (url: string, client: any) => {
  if (typeof window === 'undefined') return
  const token = getSessionToken()
  if (!token || realtimeTokens.get(url) === token) return
  try {
    client.realtime?.setAuth?.(token)
    realtimeTokens.set(url, token)
  } catch {
    // Realtime indisponível não pode impedir as consultas.
  }
}

const setEnvironment = async (client: any) => {
  const env = getAppEnv(); // 'production' or 'test'
  await client.rpc('set_app_environment', { env_name: env });
};

const isPublishableKey = (key: string | null | undefined): key is string =>
  typeof key === 'string' && key.trim().startsWith('sb_publishable_')

export const getSupabaseConfig = (env: 'production' | 'test') => {
  // We ignore the 'env' parameter because we always connect to PROD database.
  // The isolation is done via the 'environment' column in the tables.
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem(`custom_supabase_url_production`)
    const customKey = localStorage.getItem(`custom_supabase_key_production`)

    // Chaves legadas (eyJ...) foram desativadas no Supabase em 2026-11-18.
    // Uma chave antiga salva no localStorage de um navegador quebra TODAS as
    // consultas, inclusive o Realtime. Nunca deixar essa chave ser usada.
    if (customKey && !isPublishableKey(customKey)) {
      localStorage.removeItem(`custom_supabase_key_production`)
    }

    if (customUrl && isPublishableKey(customKey)) {
      const url = getValidUrl(customUrl, defaultUrlProd, 'custom_supabase_url_production')
      return { url, key: customKey.trim(), isCustom: true }
    }
  }
  return { url: defaultUrlProd, key: defaultKeyProd, isCustom: false }
}

// Helper to get the base client
export const getSupabase = () => {
  const config = getSupabaseConfig('production')
  
  if (!clients.has(config.url)) {
    const client = createClient(config.url, config.key, {
      global: { fetch: sessionAwareFetch },
    })
    setEnvironment(client);
    clients.set(config.url, client);
  }

  const client = clients.get(config.url)
  applyRealtimeToken(config.url, client)
  return client;
}

// Export a Proxy that intercepts queries to enforce Logical Isolation
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    const client = getSupabase()
    const currentEnv = getAppEnv() // 'production' or 'test'

    if (prop === 'from') {
      return (table: string) => {
        const queryBuilder = client.from(table)
        const currentOrg = TABELAS_COM_ORGANIZATION_ID.has(table)
          ? getSessionOrganizationId()
          : null

        // The following tables are global or handle isolation differently:
        // 'users' is shared across environments
        // 'user_sessions' is global to track all logins
        // 'geo_cache' is a global IP cache
        // 'organizations' e 'permissions' são catálogo global: o Proxy não
        // filtra por ambiente. app_get_rbac() já lê permissions sem filtro;
        // filtrar só no cliente deixava /usuarios sem slugs em `test`.
        // 'client_onboarding_tokens' e 'indicator_tokens' são tabelas de link
        // público: o token já limita o registro, e o indicador não tem ambiente
        // selecionado no navegador.
        // 'tasks' is currently not partitioned by environment.
        // Desde a F7 todas as views expoem a coluna 'environment', entao o
        // filtro abaixo se aplica a todas elas: uma regra unica, sem excecoes.
        if (
          table === 'users' || 
          table === 'user_sessions' || 
          table === 'geo_cache' || 
          table === 'organizations' ||
          table === 'permissions' ||
          table === 'client_onboarding_tokens' ||
          table === 'indicator_tokens' ||
          table === 'contract_diseases'
        ) {
          return queryBuilder
        }

        // For all other tables, we use a recursive Proxy to ensure the environment filter is always injected
        const createEnvProxy = (builder: any): any => {
          return new Proxy(builder, {
            get: (target, prop) => {
              const value = Reflect.get(target, prop);
              
              if (typeof value === 'function') {
                return (...args: any[]) => {
                  let result;
                  
                  if (prop === 'insert' || prop === 'upsert') {
                    const data = args[0];
                    const orgField = currentOrg ? { organization_id: currentOrg } : {};
                    const newData = Array.isArray(data)
                      ? data.map((item: any) => ({ ...item, environment: currentEnv, ...orgField }))
                      : { ...data, environment: currentEnv, ...orgField };
                    result = target[prop](newData, ...args.slice(1));
                  } else if (prop === 'select' || prop === 'update' || prop === 'delete') {
                    // Inject environment filter immediately after the action method
                    result = target[prop](...args).eq('environment', currentEnv);
                    if (currentOrg) result = result.eq('organization_id', currentOrg);
                  } else {
                    // For other methods (eq, order, limit, etc.), just execute them
                    result = value.apply(target, args);
                  }

                  // If the result is a query builder or filter builder, wrap it again to maintain the proxy chain
                  if (result && typeof result === 'object' && typeof result.then === 'function') {
                    return createEnvProxy(result);
                  }
                  
                  return result;
                };
              }
              return value;
            }
          });
        };

        return createEnvProxy(client.from(table));
      }
    }
    
    // RPC calls should not be intercepted by the environment filter
    if (prop === 'rpc') {
      return client.rpc.bind(client)
    }
    
    const value = Reflect.get(client, prop)
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})

// Always return true since we have hardcoded fallbacks
export const isSupabaseConfigured = true

/**
 * Robust wrapper for contract cancellation.
 * Uses the transactional DB function process_contract_cancellation.
 * The client-side fallback only runs on installations where the function
 * does not exist yet.
 */
export async function processContractCancellation(contractId: number, reason: string, userId: number | null) {
  if (!reason || !reason.trim()) {
    throw new Error('O motivo do cancelamento é obrigatório.');
  }

  // Caminho oficial: função transacional no banco
  const { data, error } = await supabase.rpc('process_contract_cancellation', {
    p_contract_id: contractId,
    p_reason: reason.trim(),
    p_user_id: userId ?? null
  });

  if (!error) {
    return data ?? { success: true };
  }

  const errorText = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  const functionMissing =
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    errorText.includes('could not find the function');

  if (!functionMissing) {
    // Erro de negócio (ex.: parcelas recebidas) ou de banco: não mascarar
    throw new Error(error.message || 'Falha ao cancelar o contrato.');
  }

  // Banco sem a função (instalação antiga): fallback controlado
  console.warn('[processContractCancellation] RPC ausente, usando fallback local.');
  const { data: contract, error: contractFetchError } = await supabase
    .from('contracts')
    .select('observations, status')
    .eq('id', contractId)
    .single();

  if (contractFetchError) throw contractFetchError;
  if (!contract) throw new Error('Contrato não encontrado.');

  return await performFallbackCancellation(contractId, reason.trim(), userId, contract);
}

async function performFallbackCancellation(contractId: number, reason: string, userId: number | null, contract: any) {
  const normalizedStatus = (contract.status || '').toString().trim().toLowerCase();

  // Evita transições inválidas que disparam proteção no banco (ex.: quitado -> outro status)
  if (normalizedStatus === 'quitado') {
    throw new Error('Não é possível cancelar um contrato já quitado.');
  }

  const { data: insts, error: fetchError } = await supabase
    .from('installments')
    .select('id, amountPaid, status')
    .eq('contract_id', contractId);

  if (fetchError) {
    console.error('[processContractCancellation] Installments fetch error:', fetchError);
    throw fetchError;
  }

  const hasPayments = (insts || []).some((i: any) => (Number(i.amountPaid) || 0) > 0);
  if (hasPayments) {
    console.warn('[processContractCancellation] Blocked due to payments');
    throw new Error('Não é possível cancelar um contrato com parcelas recebidas. Estorne os pagamentos antes.');
  }

  const alreadyCancelled = normalizedStatus === 'cancelado' || normalizedStatus === 'cancelada';
  const oldObs = contract.observations || '';
  const updatedObs = alreadyCancelled
    ? oldObs
    : (oldObs ? `${oldObs}\n\n[CANCELAMENTO]: ${reason}` : `[CANCELAMENTO]: ${reason}`);

  const { data: updatedContracts, error: contractUpdateError } = await supabase
    .from('contracts')
    .update({
      status: 'Cancelado',
      amountReceivable: 0,
      observations: updatedObs,
      commissionValue: 0,
      commissionPaid: false,
      updated_by: userId
    })
    .eq('id', contractId)
    .select('id');

  if (contractUpdateError) throw contractUpdateError;
  if (!updatedContracts || updatedContracts.length === 0) {
    throw new Error('Nenhum contrato foi atualizado. Verifique se ele ainda existe.');
  }

  const idsToCancel = (insts || [])
    .filter((i: any) => !['quitado', 'cancelada', 'cancelado'].includes(String(i.status || '').trim().toLowerCase()))
    .map((i: any) => i.id);

  if (idsToCancel.length > 0) {
    const { data: updatedInsts, error: installmentsUpdateError } = await supabase
      .from('installments')
      .update({ status: 'Cancelada', updated_by: userId })
      .in('id', idsToCancel)
      .select('id');

    if (installmentsUpdateError) throw installmentsUpdateError;
    if (!updatedInsts || updatedInsts.length !== idsToCancel.length) {
      throw new Error('Falha ao cancelar todas as parcelas. Nenhuma alteração foi concluída.');
    }
  }

  return { success: true, installments_updated: idsToCancel.length };
}


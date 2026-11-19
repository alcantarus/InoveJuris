import { createClient } from '@supabase/supabase-js'
import { getAppEnv } from './env'
import { getSessionToken } from './session-token'

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

// Token de sessão (F4b-2b / Fase A). Sem token, a requisição sai como hoje.
// O header só é injetado se ainda não existir — o supabase-js respeita isso.
const sessionAwareFetch: typeof fetch = (input, init) => {
  const token = typeof window === 'undefined' ? null : getSessionToken()
  if (!token) return fetch(input as any, init)

  const headers = new Headers(init?.headers)
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
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
        
        // The following tables are global or handle isolation differently:
        // 'users' is shared across environments
        // 'user_sessions' is global to track all logins
        // 'geo_cache' is a global IP cache
        // 'client_onboarding_tokens' must be accessible globally for the onboarding flow
        // 'tasks' is currently not partitioned by environment.
        // Desde a F7 todas as views expoem a coluna 'environment', entao o
        // filtro abaixo se aplica a todas elas: uma regra unica, sem excecoes.
        if (
          table === 'users' || 
          table === 'user_sessions' || 
          table === 'geo_cache' || 
          table === 'client_onboarding_tokens' ||
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
                    const newData = Array.isArray(data)
                      ? data.map((item: any) => ({ ...item, environment: currentEnv }))
                      : { ...data, environment: currentEnv };
                    result = target[prop](newData, ...args.slice(1));
                  } else if (prop === 'select' || prop === 'update' || prop === 'delete') {
                    // Inject environment filter immediately after the action method
                    result = target[prop](...args).eq('environment', currentEnv);
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
 * Tries executing via DB RPC process_contract_cancellation, 
 * and automatically falls back to secure client-side transactions if needed.
 */
export async function processContractCancellation(contractId: number, reason: string, userId: number | null) {
  // Fetch status first to check if it's 'Prorrogado' (known issue in RPC)
  const { data: contract, error: contractFetchError } = await supabase
    .from('contracts')
    .select('observations, status')
    .eq('id', contractId)
    .single();

  if (contractFetchError) throw contractFetchError;
  if (!contract) throw new Error('Contrato não encontrado.');

  // Always use fallback to avoid RPC restrictions
  return await performFallbackCancellation(contractId, reason, userId, contract);
}

async function performFallbackCancellation(contractId: number, reason: string, userId: number | null, contract: any) {
  const normalizedStatus = (contract.status || '').toString().trim().toLowerCase();

  // Defensiva: se o contrato já estiver cancelado, não tenta atualizar novamente
  if (normalizedStatus === 'cancelado' || normalizedStatus === 'cancelada') {
    return { success: true };
  }

  // Evita transições inválidas que disparam proteção no banco (ex.: quitado -> outro status)
  if (normalizedStatus === 'quitado') {
    throw new Error('Não é possível cancelar um contrato já quitado.');
  }

  const { data: insts, error: fetchError } = await supabase
    .from('installments')
    .select('*')
    .eq('contract_id', contractId);

  if (fetchError) {
    console.error('[processContractCancellation] Installments fetch error:', fetchError);
    throw fetchError;
  }

  const hasPayments = insts?.some((i: any) => (Number(i.amountPaid) || 0) > 0);
  if (hasPayments) {
    console.warn('[processContractCancellation] Blocked due to payments');
    throw new Error('Não é possível cancelar um contrato com parcelas recebidas.');
  }

  const oldObs = contract.observations || '';
  const updatedObs = oldObs
    ? `${oldObs}\n\n[CANCELAMENTO]: ${reason}`
    : `[CANCELAMENTO]: ${reason}`;

  const { error: contractUpdateError } = await supabase
    .from('contracts')
    .update({
      status: 'Cancelado',
      observations: updatedObs,
      commissionValue: 0,
      commissionPaid: false,
      updated_by: userId
    })
    .eq('id', contractId);

  if (contractUpdateError) {
    const msg = contractUpdateError.message || JSON.stringify(contractUpdateError);
    // Se o banco indicar que já está cancelado (condição de corrida/estado inconsistente), trata como sucesso
    if (/cancelad/i.test(msg)) {
      console.warn('[processContractCancellation] Contract appears already canceled in DB, treating as success:', contractUpdateError);
      return { success: true };
    }
    throw contractUpdateError;
  }

  const { error: installmentsUpdateError } = await supabase
    .from('installments')
    .update({
      status: 'Cancelada',
      updated_by: userId
    })
    .eq('contract_id', contractId);

  if (installmentsUpdateError) throw installmentsUpdateError;

  return { success: true };
}


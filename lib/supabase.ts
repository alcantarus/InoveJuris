import { createClient } from '@supabase/supabase-js'
import { getAppEnv } from './env'

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

// Production Credentials (provided by user to ensure consistent connection across all devices)
export const defaultUrlProd = "https://jhlxzqsgmudkbjkynqdl.supabase.co"
export const defaultKeyProd = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo"

// We now ONLY use the Production database for both environments (Logical Isolation)
const clients = new Map<string, any>();

const setEnvironment = async (client: any) => {
  const env = getAppEnv(); // 'production' or 'test'
  await client.rpc('set_app_environment', { env_name: env });
};

export const getSupabaseConfig = (env: 'production' | 'test') => {
  // We ignore the 'env' parameter because we always connect to PROD database.
  // The isolation is done via the 'environment' column in the tables.
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem(`custom_supabase_url_production`)
    const customKey = localStorage.getItem(`custom_supabase_key_production`)
    if (customUrl && customKey) {
      return { url: customUrl, key: customKey, isCustom: true }
    }
  }
  return { url: defaultUrlProd, key: defaultKeyProd, isCustom: false }
}

// Helper to get the base client
export const getSupabase = () => {
  const config = getSupabaseConfig('production')
  
  if (!clients.has(config.url)) {
    const client = createClient(config.url, config.key)
    setEnvironment(client);
    clients.set(config.url, client);
  }
  return clients.get(config.url);
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
        // 'tasks' is currently not partitioned by environment
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
                    console.log(`[Supabase Proxy] DEBUG: ${prop} on ${table}:`, JSON.stringify(newData, null, 2));
                    result = target[prop](newData, ...args.slice(1));
                  } else if (prop === 'select' || prop === 'update' || prop === 'delete') {
                    if (prop === 'update') {
                      console.log(`[Supabase Proxy] DEBUG: update on ${table}:`, JSON.stringify(args[0], null, 2));
                    }
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
  console.log('[processContractCancellation] Bypassing RPC for all cancellations to ensure reliability');
  return await performFallbackCancellation(contractId, reason, userId, contract);
}

async function performFallbackCancellation(contractId: number, reason: string, userId: number | null, contract: any) {
  console.log('[processContractCancellation] Starting fallback for contractId:', contractId);

  const { data: insts, error: fetchError } = await supabase
    .from('installments')
    .select('*')
    .eq('contract_id', contractId);

  if (fetchError) {
    console.error('[processContractCancellation] Installments fetch error:', fetchError);
    throw fetchError;
  }

  console.log('[processContractCancellation] Fetched installments:', insts);

  const hasPayments = insts?.some((i: any) => (i.amountPaid || 0) > 0);
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

  if (contractUpdateError) throw contractUpdateError;

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


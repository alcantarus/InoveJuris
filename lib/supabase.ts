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
  
  // NOVO: Define o usuário e a organização no contexto do banco de dados
  if (typeof window !== 'undefined') {
    const storedUser = localStorage.getItem('inovejuris_user');
    const storedOrg = localStorage.getItem('app_org'); // Assumindo que o ID da org está aqui
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.id) {
          await client.rpc('set_app_user', { user_id: user.id });
        }
      } catch (e) {
        console.error('[Supabase] Erro ao definir usuário no banco:', e);
      }
    }
    if (storedOrg) {
      try {
        // Você precisará criar esta função no banco: set_app_organization(org_id uuid)
        await client.rpc('set_app_organization', { org_id: storedOrg });
      } catch (e) {
        console.error('[Supabase] Erro ao definir organização no banco:', e);
      }
    }
  }
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
    const currentOrg = typeof window !== 'undefined' ? localStorage.getItem('app_org') : null;

    if (prop === 'from') {
      return (table: string) => {
        const queryBuilder = client.from(table)
        
        // The following tables are global or handle isolation differently:
        // 'users' is shared across environments
        // 'user_sessions' is global to track all logins
        // 'geo_cache' is a global IP cache
        // 'client_onboarding_tokens' must be accessible globally for the onboarding flow
        // 'tasks' is currently not partitioned by environment
        // 'organizations' is global
        if (
          table === 'users' || 
          table === 'user_sessions' || 
          table === 'geo_cache' || 
          table === 'client_onboarding_tokens' ||
          table === 'organizations'
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
                      ? data.map((item: any) => ({ 
                          ...item, 
                          environment: currentEnv,
                          organization_id: currentOrg 
                        }))
                      : { 
                          ...data, 
                          environment: currentEnv,
                          organization_id: currentOrg 
                        };
                    console.log(`[Supabase Proxy] DEBUG: ${prop} on ${table}:`, JSON.stringify(newData, null, 2));
                    result = target[prop](newData, ...args.slice(1));
                  } else if (prop === 'select' || prop === 'update' || prop === 'delete') {
                    if (prop === 'update') {
                      console.log(`[Supabase Proxy] DEBUG: update on ${table}:`, JSON.stringify(args[0], null, 2));
                    }
                    // Inject environment filter immediately after the action method
                    result = target[prop](...args).eq('environment', currentEnv);
                    if (currentOrg) {
                      result = result.eq('organization_id', currentOrg);
                    }
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

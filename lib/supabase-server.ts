import { createClient } from '@supabase/supabase-js'
import { defaultUrlProd, defaultKeyProd } from './supabase'
import { cookies } from 'next/headers'
import { AppEnv } from './env'

export const getSupabaseServer = async () => {
  const cookieStore = await cookies();
  const currentEnv = (cookieStore.get('app_env')?.value as AppEnv) || 'production';
  
  const client = createClient(defaultUrlProd, defaultKeyProd);
  
  // Export a Proxy that intercepts queries to enforce Logical Isolation
  return new Proxy({} as any, {
    get: (target, prop) => {
      if (prop === 'from') {
        return (table: string) => {
          const queryBuilder = client.from(table)
          
          // The following tables are global or handle isolation differently:
          // 'users' is shared across environments
          // 'user_sessions' is global to track all logins
          // 'geo_cache' is a global IP cache
          // 'client_onboarding_tokens' must be accessible globally for the onboarding flow
          if (
            table === 'users' || 
            table === 'user_sessions' || 
            table === 'geo_cache' ||
            table === 'client_onboarding_tokens'
          ) {
            return queryBuilder
          }

          // For all other tables, we intercept the methods to inject the environment filter
          return new Proxy(queryBuilder, {
            get: (qbTarget: any, qbProp) => {
              if (qbProp === 'select') {
                return (...args: any[]) => {
                  console.log(`[Supabase Server] Querying ${table} with environment: ${currentEnv}`);
                  return qbTarget.select(...args).eq('environment', currentEnv)
                }
              }
              if (qbProp === 'update') {
                return (...args: any[]) => {
                  console.log(`[Supabase Server] Updating ${table} with environment: ${currentEnv}`);
                  return qbTarget.update(...args).eq('environment', currentEnv)
                }
              }
              if (qbProp === 'delete') {
                return (...args: any[]) => {
                  console.log(`[Supabase Server] Deleting ${table} with environment: ${currentEnv}`);
                  return qbTarget.delete(...args).eq('environment', currentEnv)
                }
              }
              if (qbProp === 'insert') {
                return (data: any, ...args: any[]) => {
                  console.log(`[Supabase Server] Inserting into ${table} with environment: ${currentEnv}`);
                  let newData = data;
                  if (Array.isArray(data)) {
                    newData = data.map(item => ({ ...item, environment: currentEnv }))
                  } else {
                    newData = { ...data, environment: currentEnv }
                  }
                  return qbTarget.insert(newData, ...args)
                }
              }
              if (qbProp === 'upsert') {
                return (data: any, ...args: any[]) => {
                  console.log(`[Supabase Server] Upserting into ${table} with environment: ${currentEnv}`);
                  let newData = data;
                  if (Array.isArray(data)) {
                    newData = data.map(item => ({ ...item, environment: currentEnv }))
                  } else {
                    newData = { ...data, environment: currentEnv }
                  }
                  return qbTarget.upsert(newData, ...args)
                }
              }
              
              const value = Reflect.get(qbTarget, qbProp)
              if (typeof value === 'function') {
                return value.bind(qbTarget)
              }
              return value
            }
          })
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
}

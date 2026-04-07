import { createClient } from '@supabase/supabase-js'
import { defaultUrlProd, defaultKeyProd } from './supabase'

export const getSupabaseServer = async () => {
  return createClient(defaultUrlProd, defaultKeyProd);
}

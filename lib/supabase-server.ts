import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './supabase'

export const getSupabaseServer = async () => {
  return createClient(supabaseUrl, supabaseKey);
}

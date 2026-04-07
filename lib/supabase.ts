import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jhlxzqsgmudkbjkynqdl.supabase.co"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo"

// Cliente Supabase padrão
export const supabase = createClient(supabaseUrl, supabaseKey)

// Exportando URL e Key para uso em configurações
export { supabaseUrl, supabaseKey }

// Mantendo compatibilidade
export const getSupabase = () => supabase

// Sempre retorna true pois temos fallbacks hardcoded
export const isSupabaseConfigured = true

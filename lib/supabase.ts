import { createClient } from '@supabase/supabase-js'

// Production Credentials
export const defaultUrlProd = "https://jhlxzqsgmudkbjkynqdl.supabase.co"
export const defaultKeyProd = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo"

// Cliente Supabase padrão
export const supabase = createClient(defaultUrlProd, defaultKeyProd)

// Mantendo compatibilidade
export const getSupabase = () => supabase
export const getSupabaseConfig = (env: 'production' | 'test') => ({ url: defaultUrlProd, key: defaultKeyProd })

// Sempre retorna true pois temos fallbacks hardcoded
export const isSupabaseConfigured = true

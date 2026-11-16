import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://jhlxzqsgmudkbjkynqdl.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo"

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAudit() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('table_name', 'contracts')
    .eq('record_id', '77')
    .order('performed_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Audit logs for contract 77:', JSON.stringify(data, null, 2))
  }
}

checkAudit()

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://jhlxzqsgmudkbjkynqdl.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo"

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('performed_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error:', error)
  } else if (data) {
    console.log('Last 5 audit logs:', JSON.stringify(data, null, 2))
  }
}

checkAuditLogs()

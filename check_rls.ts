import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://jhlxzqsgmudkbjkynqdl.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo"

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRLS() {
  const { data, error } = await supabase
    .rpc('exec_sql', { sql_query: "SELECT * FROM pg_policies WHERE tablename = 'contracts'" })

  if (error) {
    console.error('Error:', error)
    // Try another way to check policies
    const { data: data2, error: error2 } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'contracts')
    
    if (error2) {
      console.error('Error 2:', error2)
    } else {
      console.log('Policies:', JSON.stringify(data2, null, 2))
    }
  } else {
    console.log('Policies:', JSON.stringify(data, null, 2))
  }
}

checkRLS()

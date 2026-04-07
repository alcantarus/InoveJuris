import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://jhlxzqsgmudkbjkynqdl.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo"

const supabase = createClient(supabaseUrl, supabaseKey)

async function listColumns() {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error:', error)
  } else if (data && data.length > 0) {
    console.log('Columns found in data:', Object.keys(data[0]))
  } else {
    console.log('No data found in contracts table.')
  }
}

listColumns()

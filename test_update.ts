import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://jhlxzqsgmudkbjkynqdl.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo"

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUpdate() {
  const { data, error } = await supabase
    .from('contracts')
    .update({
      gps_payment_date: '2026-03-27',
      gps_value: 150.50
    })
    .eq('id', 77)
    .select()

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Updated data:', JSON.stringify(data, null, 2))
  }
}

testUpdate()

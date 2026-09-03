const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://jhlxzqsgmudkbjkynqdl.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Env keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  const { data, error } = await supabase.from('installments').select('id, contract_id, status, amount, "amountPaid"').limit(10);
  if (error) {
    console.error('Error fetching installments:', error);
  } else {
    console.log('Sample installments:', data);
  }
}

run();

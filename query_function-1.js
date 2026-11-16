const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://jhlxzqsgmudkbjkynqdl.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT pg_get_functiondef(p.oid) as def
      FROM pg_proc p 
      WHERE p.proname = 'process_contract_cancellation';
    `
  });
  
  if (error) {
    console.error('Error fetching function def:', error);
  } else {
    console.log('Function definition in DB:');
    console.log(data);
  }
}

run();

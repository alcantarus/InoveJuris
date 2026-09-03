const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://jhlxzqsgmudkbjkynqdl.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Query 15 most recent contracts
  const { data: contracts, error: cError } = await supabase
    .from('contracts')
    .select('id, status, observations')
    .order('id', { ascending: false })
    .limit(15);

  if (cError) {
    console.error('Error fetching contracts:', cError);
    return;
  }

  console.log('--- RECENT CONTRACTS ---');
  for (const c of contracts) {
    console.log(`Contract ID: ${c.id}, Status: ${c.status}, Updated At: ${c.updated_at}`);
    console.log(`Observations: ${c.observations ? c.observations.substring(0, 100) : 'None'}`);
    
    // Get installments for this contract
    const { data: insts, error: iError } = await supabase
      .from('installments')
      .select('id, status, amount, "amountPaid", "dueDate"')
      .eq('contract_id', c.id);
      
    if (iError) {
      console.error(`  Error fetching installments for contract ${c.id}:`, iError);
    } else {
      console.log(`  Installments (${insts.length}):`);
      insts.forEach(i => {
        console.log(`    Inst ID: ${i.id}, Status: ${i.status}, DueDate: ${i.dueDate}, Amount: ${i.amount}, Paid: ${i.amountPaid}`);
      });
    }
    console.log('------------------------');
  }
}

run();


import { supabase } from './lib/supabase';

async function checkInstallments(contractId: string) {
  const { data, error } = await supabase
    .from('installments')
    .select('id, contract_id, amountPaid, status, installmentNumber')
    .eq('contract_id', contractId);
  
  if (error) {
    console.error('Error fetching installments:', error);
    return;
  }
  console.log('Installments found:', data);
}

checkInstallments('94');

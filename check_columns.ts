
import { supabase } from './lib/supabase.ts';

async function checkColumns() {
  const { data, error } = await supabase.from('installments').select('*').limit(1);
  if (error) {
    console.error('Error fetching one installment:', error);
    return;
  }
  console.log('Installment columns:', Object.keys(data[0] || {}));
}

checkColumns();

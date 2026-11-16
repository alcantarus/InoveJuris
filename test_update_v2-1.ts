
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://jhlxzqsgmudkbjkynqdl.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo"

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUpdate() {
  const contractId = 77; // Using contract 77 as mentioned in summary
  const testValue = 'TEST_' + new Date().getTime();
  
  console.log('Updating contract 77 with inss_protocol:', testValue);
  
  const { data: updateData, error: updateError } = await supabase
    .from('contracts')
    .update({ inssProtocol: testValue })
    .eq('id', contractId)
    .select();
    
  if (updateError) {
    console.error('Update Error:', updateError);
    return;
  }
  
  console.log('Update Result:', JSON.stringify(updateData, null, 2));
  
  const { data: selectData, error: selectError } = await supabase
    .from('contracts')
    .select('inssProtocol')
    .eq('id', contractId)
    .single();
    
  if (selectError) {
    console.error('Select Error:', selectError);
    return;
  }
  
  console.log('Current inssProtocol:', selectData.inssProtocol);
  
  if (selectData.inssProtocol === testValue) {
    console.log('SUCCESS: Update persisted.');
  } else {
    console.log('FAILURE: Update did not persist. Trigger might be blocking it.');
  }
}

testUpdate();

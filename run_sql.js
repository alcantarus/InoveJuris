const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://jhlxzqsgmudkbjkynqdl.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Please provide a file path.');
    process.exit(1);
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: sql
  });

  if (error) {
    console.error('Error executing SQL via RPC:', error);
  } else {
    console.log('SQL executed successfully');
  }
}

run();

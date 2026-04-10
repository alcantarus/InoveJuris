const { createClient } = require('@supabase/supabase-js');

// Hardcoded para garantir execução
const supabaseUrl = 'https://jhlxzqsgmudkbjkynqdl.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE product_diseases ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production';
    `
  });

  if (error) {
    console.error('Error executing SQL via RPC:', error);
    // Fallback to trying to insert directly if RPC doesn't exist, but we can't alter table without RPC.
    // Actually, we can just ask the user to run it, or I can use the postgres connection string if available.
  } else {
    console.log('SQL executed successfully');
  }
}

run();

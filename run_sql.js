const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS gps_forecast_date DATE;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS gps_payment_date DATE;
      ALTER TABLE contracts ADD COLUMN IF NOT EXISTS gps_value NUMERIC(10, 2);
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

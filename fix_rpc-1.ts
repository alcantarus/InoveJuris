import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL_PROD;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Updating search_clients RPC...');
  
  const sql = `
    CREATE OR REPLACE FUNCTION search_clients(search_term TEXT, p_environment TEXT DEFAULT 'production')
    RETURNS SETOF clients AS $$
    BEGIN
      RETURN QUERY
      SELECT *
      FROM clients
      WHERE environment = p_environment
        AND (
          unaccent(name) ILIKE unaccent('%' || search_term || '%')
          OR unaccent(email) ILIKE unaccent('%' || search_term || '%')
          OR unaccent(document) ILIKE unaccent('%' || search_term || '%')
        );
    END;
    $$ LANGUAGE plpgsql;

    -- Reload PostgREST schema cache
    NOTIFY pgrst, 'reload schema';
  `;

  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Error executing SQL via RPC:', error);
    console.log('Trying to use a different approach if exec_sql is not available...');
    // If exec_sql is not available, we can't do much from here without direct DB access.
  } else {
    console.log('RPC updated successfully!');
  }
}

run();

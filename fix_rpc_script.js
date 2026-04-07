const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Try to find credentials in common places
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL_PROD;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials (URL or Service Role Key)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Attempting to fix search_clients RPC...');
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
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

      -- Recarregar cache do PostgREST
      NOTIFY pgrst, 'reload schema';
    `
  });

  if (error) {
    console.error('Error executing SQL via RPC:', error);
  } else {
    console.log('SQL executed successfully. search_clients RPC updated.');
  }
}

run();

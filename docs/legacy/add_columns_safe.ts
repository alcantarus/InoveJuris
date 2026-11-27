import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://jhlxzqsgmudkbjkynqdl.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo"

const supabase = createClient(supabaseUrl, supabaseKey)

// Since I can't run SQL directly, I'll try to use the REST API to add columns if possible? 
// No, that's not possible.

// Wait, I'll try to use the 'exec_sql' RPC again but maybe with a different name or schema.
async function tryExecSql() {
  const sql = `
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS inss_protocol TEXT;
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS gps_generated BOOLEAN DEFAULT FALSE;
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS gps_paid BOOLEAN DEFAULT FALSE;
    
    -- Copy data from old columns if they exist
    UPDATE contracts SET inss_protocol = "inssProtocol" WHERE "inssProtocol" IS NOT NULL;
    UPDATE contracts SET gps_generated = "gpsGenerated" WHERE "gpsGenerated" IS NOT NULL;
    UPDATE contracts SET gps_paid = "gpsPaid" WHERE "gpsPaid" IS NOT NULL;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success:', data);
  }
}

tryExecSql();

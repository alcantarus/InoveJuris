import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://jhlxzqsgmudkbjkynqdl.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHh6cXNnbXVka2Jqa3lucWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzc3NTksImV4cCI6MjA4Nzk1Mzc1OX0.a9PyO6LDGVRhsNThECIema9DzAPCElp-7e-Dmiq4tRo"

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixTriggers() {
  const sql = `
    CREATE OR REPLACE FUNCTION prevent_update_delete_paid_contract()
    RETURNS TRIGGER AS $$
    BEGIN
      IF (OLD.status = 'Quitado') THEN
        RAISE EXCEPTION 'Não é possível alterar ou excluir um contrato quitado.';
      END IF;
      
      IF (TG_OP = 'UPDATE') THEN
        RETURN NEW;
      END IF;
      
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION prevent_update_delete_paid_installment()
    RETURNS TRIGGER AS $$
    BEGIN
      IF (OLD.status = 'Quitado') THEN
        RAISE EXCEPTION 'Não é possível alterar ou excluir uma parcela quitada.';
      END IF;
      
      IF (TG_OP = 'UPDATE') THEN
        RETURN NEW;
      END IF;
      
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql: sql });
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success:', data);
  }
}

fixTriggers();

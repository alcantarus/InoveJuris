import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://jhlxzqsgmudkbjkynqdl.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Missing Supabase service role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixTriggers() {
  const sql = `
    CREATE OR REPLACE FUNCTION prevent_update_delete_paid_contract()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Permite a alteração se o contrato estiver sendo cancelado (novo status 'Cancelado')
      IF (OLD.status = 'Quitado') AND (NEW.status <> 'Cancelado') THEN
        RAISE EXCEPTION 'Não é possível alterar um contrato quitado.';
      END IF;
      
      RETURN NEW;
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

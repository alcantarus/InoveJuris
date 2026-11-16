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
        IF (TG_OP = 'DELETE') THEN
          RAISE EXCEPTION 'Não é possível excluir um contrato quitado.';
        END IF;
        
        IF (TG_OP = 'UPDATE') THEN
          -- Permite a alteração se o novo status for 'Cancelado'
          IF (NEW.status = 'Cancelado') THEN
            RETURN NEW;
          END IF;

          -- Bloqueia apenas se campos financeiros ou críticos forem alterados
          IF (OLD."contractValue" <> NEW."contractValue" OR 
              OLD.status <> NEW.status OR
              OLD."installmentsCount" <> NEW."installmentsCount" OR
              COALESCE(OLD."paymentMethod", '') <> COALESCE(NEW."paymentMethod", '')) THEN
              
              RAISE EXCEPTION 'Não é possível alterar dados financeiros de um contrato quitado.';
          END IF;
        END IF;
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
        IF (TG_OP = 'DELETE') THEN
          RAISE EXCEPTION 'Não é possível excluir uma parcela quitada.';
        END IF;
        
        IF (TG_OP = 'UPDATE') THEN
          -- Permite a alteração se o novo status for 'Cancelada'
          IF (NEW.status = 'Cancelada') THEN
            RETURN NEW;
          END IF;

          -- Bloqueia apenas se campos financeiros forem alterados
          IF (OLD.amount <> NEW.amount OR 
              OLD."dueDate" <> NEW."dueDate" OR 
              OLD."amountPaid" <> NEW."amountPaid" OR 
              OLD.status <> NEW.status OR
              COALESCE(OLD.interest, 0) <> COALESCE(NEW.interest, 0) OR
              COALESCE(OLD.fine, 0) <> COALESCE(NEW.fine, 0)) THEN
              
              RAISE EXCEPTION 'Não é possível alterar dados financeiros de uma parcela quitada.';
          END IF;
        END IF;
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

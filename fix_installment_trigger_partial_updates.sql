-- Fix triggers to allow updating non-financial fields (like GPS control) on paid contracts and installments

CREATE OR REPLACE FUNCTION prevent_update_delete_paid_contract()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status = 'Quitado') THEN
    IF (TG_OP = 'DELETE') THEN
      RAISE EXCEPTION 'Não é possível excluir um contrato quitado.';
    END IF;
    
    IF (TG_OP = 'UPDATE') THEN
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

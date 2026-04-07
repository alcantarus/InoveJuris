-- Fix trigger functions that were incorrectly returning OLD instead of NEW, 
-- effectively blocking all updates to contracts and installments that were not 'Quitado'.

CREATE OR REPLACE FUNCTION prevent_update_delete_paid_contract()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status = 'Quitado') THEN
    RAISE EXCEPTION 'Não é possível alterar ou excluir um contrato quitado.';
  END IF;
  
  -- For UPDATE, we must return NEW to allow the changes to persist.
  -- For DELETE, returning OLD is fine (but we already checked for 'Quitado').
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
  
  -- For UPDATE, we must return NEW to allow the changes to persist.
  -- For DELETE, returning OLD is fine (but we already checked for 'Quitado').
  IF (TG_OP = 'UPDATE') THEN
    RETURN NEW;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

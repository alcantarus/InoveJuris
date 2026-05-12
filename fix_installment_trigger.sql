
CREATE OR REPLACE FUNCTION prevent_update_delete_paid_installment()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    -- Permite a alteração se a parcela estiver sendo cancelada (novo status 'Cancelada')
    IF (OLD.status = 'Quitado') AND (NEW.status = 'Cancelada') THEN
      RETURN NEW;
    END IF;
    
    -- Bloqueia apenas se a parcela estiver estritamente 'Quitado'
    IF (OLD.status = 'Quitado') THEN
      RAISE EXCEPTION 'Não é possível alterar uma parcela quitada.';
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    -- Bloqueia apenas se a parcela estiver estritamente 'Quitado'
    IF (OLD.status = 'Quitado') THEN
      RAISE EXCEPTION 'Não é possível excluir uma parcela quitada.';
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

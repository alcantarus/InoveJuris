
CREATE OR REPLACE FUNCTION public.fn_protect_contracts_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $$
BEGIN
  -- Log para debug
  RAISE NOTICE 'fn_protect_contracts_status: OLD.status=%, NEW.status=%', OLD.status, NEW.status;

  -- REGRA ROBUSTA: Se o novo status for 'Cancelado', permitimos a transição
  IF (NEW.status = 'Cancelado') THEN
    RETURN NEW;
  END IF;

  -- Regra de proteção para outros casos
  IF (OLD.status = 'Quitado' OR OLD.status = 'Cancelado') 
     AND (NEW.status != 'Quitado' AND NEW.status != 'Cancelado') THEN
    RAISE EXCEPTION 'Não é possível alterar um contrato já quitado ou cancelado. OLD.status=%, NEW.status=%', OLD.status, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$;

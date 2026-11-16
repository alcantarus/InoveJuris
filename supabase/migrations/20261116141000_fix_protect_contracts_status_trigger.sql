-- Garante que o gatilho de proteção de status do contrato permita cancelamento
-- e evite bloqueios indevidos por variações de texto/espaços.

CREATE OR REPLACE FUNCTION public.fn_protect_contracts_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old text := lower(btrim(coalesce(OLD.status, '')));
  v_new text := lower(btrim(coalesce(NEW.status, '')));
BEGIN
  -- Permite transição para cancelado (idempotente e segura para fluxos de cancelamento)
  IF v_new = 'cancelado' OR v_new = 'cancelada' THEN
    RETURN NEW;
  END IF;

  -- Bloqueia tentativa de "reabrir"/alterar contratos já quitados ou cancelados
  IF (v_old IN ('quitado', 'cancelado', 'cancelada'))
     AND (v_new NOT IN ('quitado', 'cancelado', 'cancelada')) THEN
    RAISE EXCEPTION 'BLOQUEADO: OLD=% , NEW=% . Não é possível alterar um contrato já quitado ou cancelado.', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

-- Garante que o trigger exista apontando para a função atualizada (se a tabela existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contracts'
  ) THEN
    -- Remove triggers conhecidos com nomes comuns, se existirem, para evitar múltiplas versões conflitantes
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_contracts_status') THEN
      EXECUTE 'DROP TRIGGER trg_protect_contracts_status ON public.contracts';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'protect_contracts_status') THEN
      EXECUTE 'DROP TRIGGER protect_contracts_status ON public.contracts';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fn_protect_contracts_status') THEN
      EXECUTE 'DROP TRIGGER trg_fn_protect_contracts_status ON public.contracts';
    END IF;

    EXECUTE '
      CREATE TRIGGER trg_protect_contracts_status
      BEFORE UPDATE OF status ON public.contracts
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_protect_contracts_status()
    ';
  END IF;
END;
$$;

-- ============================================================================
-- CORREÇÃO — recebimento parcial bloqueado por "contrato quitado"
-- Data: 25/11/2026
--
-- Problema:
--   rpc_recebimento_com_desdobramento fecha a parcela original (status
--   'Quitado') ANTES de inserir a residual. O gatilho de recálculo roda ao fim
--   de cada statement; quando a parcela recebida é a ÚLTIMA em aberto, o
--   contrato fica momentaneamente 'Quitado' e, ao inserir a residual, o
--   recálculo tenta 'Quitado' -> 'Parcial' e a proteção bloqueia:
--     P0001  Não é possível reabrir um contrato quitado.
--
-- Correção:
--   Permitir 'Quitado' -> 'Parcial' nas DUAS funções de proteção SOMENTE
--   quando existir parcela real em aberto (mesma regra usada por
--   fn_recalculate_contract_totals). Contrato efetivamente quitado, sem saldo
--   real, continua bloqueado.
--
-- Escopo:
--   - CREATE OR REPLACE em prevent_update_delete_paid_contract()
--   - CREATE OR REPLACE em fn_protect_contracts_status()
--   - NÃO altera gatilhos, tabelas, policies, dados, RPCs ou grants.
--   - Backup das definições atuais em backup_contratos_protecao_20261125.
--
-- Observação: o agente não executa SQL. Este script é para você rodar.
-- ============================================================================

BEGIN;

-- 1) Backup das definições atuais -------------------------------------------
CREATE TABLE IF NOT EXISTS public.backup_contratos_protecao_20261125 (
  objeto        TEXT PRIMARY KEY,
  definicao     TEXT,
  capturado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.backup_contratos_protecao_20261125 (objeto, definicao)
SELECT 'function:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       pg_get_functiondef(p.oid)
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace
   AND p.proname IN (
     'prevent_update_delete_paid_contract',
     'fn_protect_contracts_status'
   )
ON CONFLICT (objeto) DO UPDATE
   SET definicao = EXCLUDED.definicao,
       capturado_em = now();

INSERT INTO public.backup_contratos_protecao_20261125 (objeto, definicao)
SELECT 'trigger:' || t.tgname, pg_get_triggerdef(t.oid)
  FROM pg_trigger t
 WHERE t.tgrelid = 'public.contracts'::regclass
   AND NOT t.tgisinternal
   AND t.tgname IN (
     'prevent_update_delete_paid_contract_trigger',
     'trg_protect_contracts_status'
   )
ON CONFLICT (objeto) DO UPDATE
   SET definicao = EXCLUDED.definicao,
       capturado_em = now();

-- 2) Pré-validação: aborta se as funções não estiverem na versão esperada ----
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'prevent_update_delete_paid_contract'
       AND (pg_get_functiondef(p.oid) LIKE '%v2 20261121%'
            OR pg_get_functiondef(p.oid) LIKE '%v3 20261125%')
  ) THEN
    RAISE EXCEPTION
      'Abortado: prevent_update_delete_paid_contract não está na versão v2/v3 esperada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'fn_protect_contracts_status'
       AND (pg_get_functiondef(p.oid) LIKE '%v2 20261121%'
            OR pg_get_functiondef(p.oid) LIKE '%v3 20261125%')
  ) THEN
    RAISE EXCEPTION
      'Abortado: fn_protect_contracts_status não está na versão v2/v3 esperada.';
  END IF;
END $$;

-- 3) prevent_update_delete_paid_contract --------------------------------
--    Mantém toda a proteção atual e abre apenas a exceção do desdobramento.
CREATE OR REPLACE FUNCTION public.prevent_update_delete_paid_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- v3 20261125
  -- excecao-desdobramento-20261125

  IF TG_OP = 'DELETE' THEN
    IF lower(coalesce(OLD.status, '')) = 'quitado' THEN
      RAISE EXCEPTION 'Não é possível excluir um contrato quitado.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  -- Estados de encerramento: permitidos a partir de Quitado / Prorrogado / Estornado
  IF lower(coalesce(OLD.status, '')) IN ('quitado', 'prorrogado', 'estornado')
     AND lower(coalesce(NEW.status, '')) IN ('quitado', 'cancelado', 'estornado') THEN

    -- Se o status não muda, protege os dados estruturais do contrato quitado
    IF lower(NEW.status) = lower(OLD.status)
       AND ( OLD."contractValue"     IS DISTINCT FROM NEW."contractValue"
          OR OLD."installmentsCount" IS DISTINCT FROM NEW."installmentsCount"
          OR COALESCE(OLD."paymentMethod", '') <> COALESCE(NEW."paymentMethod", '') ) THEN
      RAISE EXCEPTION 'Não é possível alterar dados financeiros de um contrato quitado.';
    END IF;

    RETURN NEW;
  END IF;

  -- Exceção controlada: o recálculo reabre para 'Parcial' apenas quando há
  -- parcela real em aberto (mesma regra de fn_recalculate_contract_totals).
  IF lower(coalesce(OLD.status, '')) = 'quitado'
     AND lower(coalesce(NEW.status, '')) = 'parcial'
     AND EXISTS (
       SELECT 1
         FROM public.installments i
        WHERE i.contract_id = OLD.id
          AND lower(coalesce(i.status, '')) NOT IN
              ('quitado', 'cancelado', 'cancelada', 'estornado')
          AND greatest(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0) > 0.01
     ) THEN
    RETURN NEW;
  END IF;

  -- Quitado não pode voltar para Aberto / Parcial / Prorrogado
  IF lower(coalesce(OLD.status, '')) = 'quitado' THEN
    RAISE EXCEPTION 'Não é possível reabrir um contrato quitado.';
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) fn_protect_contracts_status --------------------------------------------
--    Mesma exceção, para o gatilho BEFORE UPDATE OF status.
CREATE OR REPLACE FUNCTION public.fn_protect_contracts_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_old text := lower(btrim(coalesce(OLD.status, '')));
  v_new text := lower(btrim(coalesce(NEW.status, '')));
BEGIN
  -- v3 20261125
  -- excecao-desdobramento-20261125

  -- 1) Status de encerramento sempre podem ser gravados
  IF v_new IN ('cancelado', 'cancelada', 'estornado') THEN
    RETURN NEW;
  END IF;

  -- 2) Regravar o mesmo status é sempre permitido (idempotência)
  IF v_new = v_old THEN
    RETURN NEW;
  END IF;

  -- 3) Estornado pode ser reaberto por um novo pagamento
  IF v_old = 'estornado' THEN
    RETURN NEW;
  END IF;

  -- 4) Exceção controlada do desdobramento: Quitado -> Parcial com saldo real
  IF v_old = 'quitado'
     AND v_new = 'parcial'
     AND EXISTS (
       SELECT 1
         FROM public.installments i
        WHERE i.contract_id = OLD.id
          AND lower(coalesce(i.status, '')) NOT IN
              ('quitado', 'cancelado', 'cancelada', 'estornado')
          AND greatest(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0) > 0.01
     ) THEN
    RETURN NEW;
  END IF;

  -- 5) Quitado e Cancelado não podem ser reabertos silenciosamente
  IF v_old IN ('quitado', 'cancelado', 'cancelada') THEN
    RAISE EXCEPTION
      'BLOQUEADO: OLD=% , NEW=% . Não é possível reabrir um contrato quitado ou cancelado.',
      OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO (último resultset)
-- ============================================================================
SELECT jsonb_build_object(
  'backup_objetos', (
    SELECT COUNT(*) FROM public.backup_contratos_protecao_20261125
  ),
  'prevent_update_delete_paid_contract_v3', EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'prevent_update_delete_paid_contract'
       AND pg_get_functiondef(p.oid) LIKE '%excecao-desdobramento-20261125%'
  ),
  'fn_protect_contracts_status_v3', EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'fn_protect_contracts_status'
       AND pg_get_functiondef(p.oid) LIKE '%excecao-desdobramento-20261125%'
  ),
  'gatilhos_de_protecao_intactos', (
    SELECT COUNT(*) FROM pg_trigger t
     WHERE t.tgrelid = 'public.contracts'::regclass
       AND NOT t.tgisinternal
       AND t.tgname IN (
         'prevent_update_delete_paid_contract_trigger',
         'trg_protect_contracts_status'
       )
  )
) AS correcao_recebimento_parcial;

-- ============================================================================
-- ROLLBACK (usar somente se necessário)
-- Restaura as definições exatas capturadas antes da correção.
-- ============================================================================
-- BEGIN;
-- DO $$
-- DECLARE
--   r RECORD;
-- BEGIN
--   FOR r IN
--     SELECT definicao
--       FROM public.backup_contratos_protecao_20261125
--      WHERE objeto LIKE 'function:%'
--      ORDER BY capturado_em
--   LOOP
--     EXECUTE r.definicao;
--   END LOOP;
-- END $$;
-- COMMIT;

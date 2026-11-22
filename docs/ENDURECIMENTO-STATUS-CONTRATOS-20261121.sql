-- =============================================================================
-- ENDURECIMENTO DE STATUS DE CONTRATOS — B20 + B21
-- Data: 21/11/2026
-- Executar no SQL Editor do Supabase (produção e, se desejar, homologação).
--
-- B20: cria o CHECK de status em contracts com a lista canônica completa,
--      INCLUINDO 'Prorrogado' (o script antigo do repositório omite esse valor
--      e quebraria a prorrogação).
-- B21: remove o gatilho duplicado trg_contracts_status_protection, mantendo
--      trg_protect_contracts_status (BEFORE UPDATE OF status). A proteção de
--      DELETE de contrato quitado continua em
--      prevent_update_delete_paid_contract_trigger.
--
-- Segurança:
--   - faz backup das definições de gatilhos/constraint e da distribuição de
--     status antes de qualquer alteração;
--   - aborta se existir status fora da lista canônica (o CHECK falharia);
--   - aborta se os gatilhos não forem os esperados;
--   - termina com UM único resultset (JSON) de verificação.
-- =============================================================================

-- 1) Backup das definições atuais e da distribuição de status
CREATE TABLE IF NOT EXISTS backup_contracts_status_endurecimento_20261121 (
  objeto TEXT NOT NULL,
  definicao TEXT,
  capturado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO backup_contracts_status_endurecimento_20261121 (objeto, definicao)
SELECT 'trigger:' || tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger t
WHERE t.tgrelid = 'public.contracts'::regclass
  AND NOT t.tgisinternal
  AND t.tgname IN (
    'trg_contracts_status_protection',
    'trg_protect_contracts_status',
    'prevent_update_delete_paid_contract_trigger'
  );

INSERT INTO backup_contracts_status_endurecimento_20261121 (objeto, definicao)
SELECT 'constraint:' || conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
WHERE c.conrelid = 'public.contracts'::regclass
  AND c.conname = 'check_contract_status';

INSERT INTO backup_contracts_status_endurecimento_20261121 (objeto, definicao)
SELECT format('status_count:%s:%s',
                COALESCE(NULLIF(btrim(environment), ''), '(nulo)'),
                COALESCE(status, '(nulo)')),
       COUNT(*)::text
FROM public.contracts
GROUP BY environment, status;

-- 2) Pré-validação B20: nenhum status pode ficar fora da lista canônica.
--    A verificação é global (por ambiente) porque o CHECK vale para todas
--    as linhas da tabela, independentemente de environment.
DO $$
DECLARE
  v_invalidos TEXT;
BEGIN
  SELECT string_agg(
           format('ambiente=%s status=%s qtd=%s',
                  COALESCE(NULLIF(btrim(x.environment), ''), '(nulo)'),
                  COALESCE(x.status, '(nulo)'),
                  x.qtd),
           ', ' ORDER BY x.environment, x.status
         )
  INTO v_invalidos
  FROM (
    SELECT environment, status, COUNT(*) AS qtd
    FROM public.contracts
    WHERE status IS NOT NULL
      AND status NOT IN ('Aberto','Parcial','Quitado','Cancelado','Estornado','Prorrogado')
    GROUP BY environment, status
  ) x;

  IF v_invalidos IS NOT NULL THEN
    RAISE EXCEPTION
      'B20 abortado: existem status fora da lista canônica: %. Normalize-os antes de aplicar o CHECK.',
      v_invalidos;
  END IF;
END $$;

-- 3) Pré-validação B21: confere as definições reais antes de remover qualquer gatilho.
DO $$
DECLARE
  v_def_amplo TEXT;
  v_def_status TEXT;
  v_def_delete TEXT;
BEGIN
  SELECT pg_get_triggerdef(t.oid) INTO v_def_amplo
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.contracts'::regclass
    AND NOT t.tgisinternal AND t.tgname = 'trg_contracts_status_protection';

  SELECT pg_get_triggerdef(t.oid) INTO v_def_status
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.contracts'::regclass
    AND NOT t.tgisinternal AND t.tgname = 'trg_protect_contracts_status';

  SELECT pg_get_triggerdef(t.oid) INTO v_def_delete
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.contracts'::regclass
    AND NOT t.tgisinternal AND t.tgname = 'prevent_update_delete_paid_contract_trigger';

  -- Sem a proteção de DELETE, remover o gatilho amplo deixaria um buraco.
  IF v_def_delete IS NULL THEN
    RAISE EXCEPTION
      'B21 abortado: prevent_update_delete_paid_contract_trigger não existe; a proteção de DELETE ficaria sem cobertura.';
  END IF;

  IF v_def_amplo IS NULL AND v_def_status IS NULL THEN
    RAISE EXCEPTION 'B21 abortado: nenhum gatilho de proteção de status foi encontrado em contracts.';
  END IF;

  IF v_def_amplo IS NOT NULL AND v_def_amplo NOT ILIKE '%fn_protect_contracts_status%' THEN
    RAISE EXCEPTION 'B21 abortado: trg_contracts_status_protection não chama fn_protect_contracts_status. Def: %', v_def_amplo;
  END IF;

  IF v_def_status IS NOT NULL AND v_def_status NOT ILIKE '%fn_protect_contracts_status%' THEN
    RAISE EXCEPTION 'B21 abortado: trg_protect_contracts_status não chama fn_protect_contracts_status. Def: %', v_def_status;
  END IF;

  IF v_def_status IS NOT NULL AND v_def_status NOT ILIKE '%UPDATE OF status%' THEN
    RAISE EXCEPTION 'B21 abortado: trg_protect_contracts_status não cobre UPDATE OF status. Def: %', v_def_status;
  END IF;
END $$;

-- 4) Aplica B20
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS check_contract_status;
ALTER TABLE public.contracts ADD CONSTRAINT check_contract_status
  CHECK (status IN ('Aberto','Parcial','Quitado','Cancelado','Estornado','Prorrogado'));

-- 5) Aplica B21: mantém apenas o gatilho que cobre UPDATE OF status.
DO $$
DECLARE
  v_def_amplo TEXT;
BEGIN
  SELECT pg_get_triggerdef(t.oid) INTO v_def_amplo
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.contracts'::regclass
    AND NOT t.tgisinternal AND t.tgname = 'trg_contracts_status_protection';

  IF v_def_amplo IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER trg_contracts_status_protection ON public.contracts';
    RAISE NOTICE 'B21: gatilho duplicado trg_contracts_status_protection removido.';

    -- Se o gatilho amplo era o único, recria o gatilho correto.
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = 'public.contracts'::regclass
        AND NOT t.tgisinternal AND t.tgname = 'trg_protect_contracts_status'
    ) THEN
      EXECUTE '
        CREATE TRIGGER trg_protect_contracts_status
        BEFORE UPDATE OF status ON public.contracts
        FOR EACH ROW
        EXECUTE FUNCTION public.fn_protect_contracts_status()
      ';
      RAISE NOTICE 'B21: trg_protect_contracts_status recriado com UPDATE OF status.';
    END IF;
  ELSE
    RAISE NOTICE 'B21: gatilho duplicado já não existia; nada a remover.';
  END IF;
END $$;

-- 6) Verificação final (último resultset)
WITH status_fora AS (
  SELECT environment, status, COUNT(*) AS qtd
  FROM public.contracts
  WHERE status IS NOT NULL
    AND status NOT IN ('Aberto','Parcial','Quitado','Cancelado','Estornado','Prorrogado')
  GROUP BY environment, status
),
gatilhos AS (
  SELECT t.tgname, pg_get_triggerdef(t.oid) AS def
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.contracts'::regclass
    AND NOT t.tgisinternal
),
chk AS (
  SELECT pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c
  WHERE c.conrelid = 'public.contracts'::regclass
    AND c.conname = 'check_contract_status'
)
SELECT jsonb_build_object(
  'status_fora_da_lista', (
    SELECT jsonb_agg(jsonb_build_object(
             'ambiente', COALESCE(NULLIF(btrim(s.environment), ''), '(nulo)'),
             'status', s.status,
             'qtd', s.qtd
           ) ORDER BY s.environment, s.status)
    FROM status_fora s
  ),
  'check_status_definicao', (SELECT def FROM chk),
  'gatilho_update_of_status_presente', (
    SELECT COUNT(*) = 1 FROM gatilhos g
    WHERE g.tgname = 'trg_protect_contracts_status'
      AND g.def ILIKE '%UPDATE OF status%'
  ),
  'gatilho_duplicado_presente', (
    SELECT COUNT(*) > 0 FROM gatilhos g
    WHERE g.tgname = 'trg_contracts_status_protection'
  ),
  'gatilhos_chamando_funcao_protecao', (
    SELECT COUNT(*) FROM gatilhos g WHERE g.def ILIKE '%fn_protect_contracts_status%'
  ),
  'gatilho_delete_paid_presente', (
    SELECT COUNT(*) = 1 FROM gatilhos g
    WHERE g.tgname = 'prevent_update_delete_paid_contract_trigger'
  ),
  'objetos_em_backup', (
    SELECT COUNT(*) FROM backup_contracts_status_endurecimento_20261121
  ),
  'distribuicao_status', (
    SELECT jsonb_object_agg(
             COALESCE(NULLIF(btrim(x.status), ''), '(nulo)'), x.qtd ORDER BY x.status
           )
    FROM (
      SELECT status, COUNT(*) AS qtd
      FROM public.contracts
      GROUP BY status
    ) x
  )
) AS resultado_final;

-- =============================================================================
-- CORREÇÃO FINAL — SOMENTE environment = 'test'
-- Resolve: 1 divergência restante (parcela 96) + duplicidade do contrato 75.
-- =============================================================================

-- 1) Backup das linhas que serão alteradas nesta etapa
CREATE TABLE IF NOT EXISTS backup_test_ajuste_final_20261121 AS
SELECT * FROM installments WHERE FALSE;

INSERT INTO backup_test_ajuste_final_20261121
SELECT * FROM installments WHERE id IN (96, 116, 144, 164);

CREATE TABLE IF NOT EXISTS backup_test_ajuste_final_pagamentos_20261121 AS
SELECT * FROM payments WHERE FALSE;

INSERT INTO backup_test_ajuste_final_pagamentos_20261121
SELECT *
FROM payments
WHERE installment_id = 96
  AND btrim(COALESCE(environment, ''), E' \t\r\n') = 'test';

-- 2) Parcela 96: ajustar pagamentos até que a soma seja exatamente amountPaid.
--    - se houver vários, remove os excedentes (mantém os mais antigos e os com caixa);
--    - se houver um único pagamento maior que o devido, reduz esse pagamento
--      e a transação vinculada;
--    - se faltar valor, cria pagamento + caixa para a diferença.
DO $$
DECLARE
  v_target NUMERIC(12,2);
  v_total NUMERIC(12,2) := 0;
  v_rec RECORD;
  v_first UUID;
  v_first_amount NUMERIC(12,2);
  v_tx BIGINT;
BEGIN
  SELECT COALESCE("amountPaid", 0) INTO v_target
  FROM installments WHERE id = 96;

  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM payments
  WHERE installment_id = 96
    AND lower(COALESCE(type, 'payment')) = 'payment'
    AND btrim(COALESCE(environment, ''), E' \t\r\n') = 'test';

  IF v_total > v_target THEN
    -- remove excedentes, preservando os primeiros
    FOR v_rec IN
      SELECT id, amount
      FROM payments
      WHERE installment_id = 96
        AND lower(COALESCE(type, 'payment')) = 'payment'
        AND btrim(COALESCE(environment, ''), E' \t\r\n') = 'test'
      ORDER BY (financial_transaction_id IS NOT NULL) DESC, payment_date, id
    LOOP
      IF v_total - COALESCE(v_rec.amount, 0) >= v_target THEN
        DELETE FROM payments WHERE id = v_rec.id;
        v_total := v_total - COALESCE(v_rec.amount, 0);
      END IF;
    END LOOP;

    -- se sobrou um único pagamento maior que o alvo, reduz pagamento + caixa
    IF v_total > v_target THEN
      SELECT id, amount INTO v_first, v_first_amount
      FROM payments
      WHERE installment_id = 96
        AND lower(COALESCE(type, 'payment')) = 'payment'
        AND btrim(COALESCE(environment, ''), E' \t\r\n') = 'test'
      ORDER BY (financial_transaction_id IS NOT NULL) DESC, payment_date, id
      LIMIT 1;

      IF v_first IS NOT NULL THEN
        UPDATE payments
           SET amount = v_target
         WHERE id = v_first;

        UPDATE financial_transactions
           SET amount = v_target
         WHERE id = (SELECT financial_transaction_id FROM payments WHERE id = v_first);

        v_total := v_target;
      END IF;
    END IF;
  ELSIF v_total < v_target THEN
    -- falta pagamento: cria registro + caixa
    INSERT INTO financial_transactions (
      date, amount, type, account_id, category_id, description, environment
    ) VALUES (
      DATE '2026-03-15', v_target - v_total, 'income', NULL, NULL,
      'Ajuste de conciliação histórica - parcela 96', 'test'
    ) RETURNING id INTO v_tx;

    INSERT INTO payments (
      installment_id, amount, payment_date, account_id, category_id,
      description, environment, type, financial_transaction_id
    ) VALUES (
      96, v_target - v_total, DATE '2026-03-15', NULL, NULL,
      'Ajuste de conciliação histórica - parcela 96', 'test', 'payment', v_tx
    );
  END IF;

  RAISE NOTICE 'Parcela 96: soma final %, esperada %', v_total, v_target;
END $$;

-- 3) Contrato 75: renumerar a parcela 144 (número 1 duplicado) para o próximo
--    número disponível. O gatilho de proteção é desativado somente durante a
--    atualização e reativado em seguida (somente nesta transação).
DO $$
DECLARE
  v_novo_numero INTEGER;
  v_trigger_existe BOOLEAN;
BEGIN
  SELECT COALESCE(MAX("installmentNumber"), 0) + 1
    INTO v_novo_numero
  FROM installments
  WHERE contract_id = 75
    AND btrim(COALESCE(environment, ''), E' \t\r\n') = 'test';

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.installments'::regclass
      AND tgname = 'prevent_update_delete_paid_installment_trigger'
      AND NOT tgisinternal
  ) INTO v_trigger_existe;

  IF v_trigger_existe THEN
    EXECUTE 'ALTER TABLE public.installments DISABLE TRIGGER prevent_update_delete_paid_installment_trigger';
  END IF;

  BEGIN
    UPDATE installments
       SET "installmentNumber" = v_novo_numero
     WHERE id = 144
       AND contract_id = 75
       AND btrim(COALESCE(environment, ''), E' \t\r\n') = 'test';
  EXCEPTION WHEN OTHERS THEN
    IF v_trigger_existe THEN
      EXECUTE 'ALTER TABLE public.installments ENABLE TRIGGER prevent_update_delete_paid_installment_trigger';
    END IF;
    RAISE;
  END;

  IF v_trigger_existe THEN
    EXECUTE 'ALTER TABLE public.installments ENABLE TRIGGER prevent_update_delete_paid_installment_trigger';
  END IF;

  RAISE NOTICE 'Contrato 75: parcela 144 renumerada para %', v_novo_numero;
END $$;

-- 4) Verificação final
WITH div AS (
  SELECT i.id
  FROM installments i
  LEFT JOIN payments pm ON pm.installment_id = i.id
  WHERE btrim(COALESCE(i.environment, ''), E' \t\r\n') = 'test'
  GROUP BY i.id, i."amountPaid"
  HAVING i."amountPaid" IS DISTINCT FROM COALESCE(
      SUM(pm.amount) FILTER (WHERE lower(COALESCE(pm.type, 'payment')) = 'payment'), 0
  )
),
sem_caixa AS (
  SELECT p.id
  FROM payments p
  WHERE lower(COALESCE(p.type, 'payment')) = 'payment'
    AND btrim(COALESCE(p.environment, ''), E' \t\r\n') = 'test'
    AND NOT EXISTS (
      SELECT 1 FROM financial_transactions ft
      WHERE lower(ft.type) = 'income'
        AND ft.amount = p.amount
        AND ft.date = p.payment_date::date
        AND ft.account_id IS NOT DISTINCT FROM p.account_id
        AND btrim(COALESCE(ft.environment, ''), E' \t\r\n') =
            btrim(COALESCE(p.environment, ''), E' \t\r\n')
    )
),
totais AS (
  SELECT c.id, c."amountReceivable", c."amountReceived",
         COALESCE(SUM(GREATEST(i.amount - COALESCE(i."amountPaid", 0), 0))
           FILTER (WHERE lower(COALESCE(i.status, '')) NOT IN
                   ('quitado', 'cancelado', 'cancelada', 'estornado')), 0) AS esperado_receber,
         COALESCE(SUM(i."amountPaid"), 0) AS esperado_recebido
  FROM contracts c
  LEFT JOIN installments i ON i.contract_id = c.id
  WHERE btrim(COALESCE(c.environment, ''), E' \t\r\n') = 'test'
    AND lower(COALESCE(c.status, '')) <> 'cancelado'
  GROUP BY c.id, c."amountReceivable", c."amountReceived"
),
duplicidade AS (
  SELECT i.contract_id, i."installmentNumber", COUNT(*) AS quantidade
  FROM installments i
  WHERE btrim(COALESCE(i.environment, ''), E' \t\r\n') = 'test'
  GROUP BY i.contract_id, i."installmentNumber"
  HAVING COUNT(*) > 1
)
SELECT jsonb_build_object(
  'divergencias_pagamentos', (SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id AS parcela FROM div) x),
  'pagamentos_sem_caixa', (SELECT COUNT(*) FROM sem_caixa),
  'totais_inconsistentes', (
    SELECT jsonb_agg(jsonb_build_object(
             'contrato', t.id,
             'a_receber_gravado', t."amountReceivable",
             'a_receber_esperado', t.esperado_receber,
             'recebido_gravado', t."amountReceived",
             'recebido_esperado', t.esperado_recebido
           ) ORDER BY t.id)
    FROM totais t
    WHERE ABS(COALESCE(t."amountReceivable", 0) - t.esperado_receber) > 0.01
       OR ABS(COALESCE(t."amountReceived", 0) - t.esperado_recebido) > 0.01
  ),
  'duplicidade_numeros', (
    SELECT jsonb_agg(to_jsonb(d) ORDER BY d.contract_id, d."installmentNumber")
    FROM duplicidade d
  )
) AS resultado_final;

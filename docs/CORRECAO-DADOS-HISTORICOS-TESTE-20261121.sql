-- =============================================================================
-- CORREÇÃO DE DADOS HISTÓRICOS — SOMENTE environment = 'test'
-- Baseado nos diagnósticos de 21/11/2026. Nenhuma linha de production é afetada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) BACKUPS (estrutura + linhas afetadas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backup_test_pagamentos_conciliacao_20261121 AS
SELECT * FROM payments WHERE FALSE;

INSERT INTO backup_test_pagamentos_conciliacao_20261121
SELECT *
FROM payments
WHERE btrim(COALESCE(environment, ''), E' \t\r\n') = 'test'
  AND (
    id IN (
      '43991f38-83a7-4122-804f-f58a803ec60d',
      '0e107f28-53f5-402a-a95e-24d8d0f3dbee',
      '776d67f8-f428-47a9-80c2-58f36847595f',
      'f5265f51-a99a-4822-96c8-b91c939b43a3',
      '3715c3de-f5ed-4ce9-a2ff-ca75fa43a3b9'
    )
    OR installment_id IN (96, 97, 113, 122, 150, 151, 227)
  );

CREATE TABLE IF NOT EXISTS backup_test_installments_conciliacao_20261121 AS
SELECT * FROM installments WHERE FALSE;

INSERT INTO backup_test_installments_conciliacao_20261121
SELECT *
FROM installments
WHERE id IN (87, 89, 96, 97, 103, 113, 122, 129, 150, 151, 227);

CREATE TABLE IF NOT EXISTS backup_test_contracts_conciliacao_20261121 AS
SELECT * FROM contracts WHERE FALSE;

INSERT INTO backup_test_contracts_conciliacao_20261121
SELECT *
FROM contracts
WHERE id IN (65, 67, 70, 74, 76, 81, 91, 134);

-- -----------------------------------------------------------------------------
-- 2) Remover pagamentos órfãos (excedente exato sobre amountPaid, sem caixa)
--    87: +2500 | 89: +1000 | 103: +400 | 129: +4000 | 227: +1000 (estornado)
-- -----------------------------------------------------------------------------
DELETE FROM payments
WHERE id IN (
  '43991f38-83a7-4122-804f-f58a803ec60d',
  '0e107f28-53f5-402a-a95e-24d8d0f3dbee',
  '776d67f8-f428-47a9-80c2-58f36847595f',
  'f5265f51-a99a-4822-96c8-b91c939b43a3',
  '3715c3de-f5ed-4ce9-a2ff-ca75fa43a3b9'
)
AND btrim(COALESCE(environment, ''), E' \t\r\n') = 'test';

-- -----------------------------------------------------------------------------
-- 3) Parcela 96: remover pagamentos excedentes até que a soma = amountPaid
--    (mantém os mais antigos e os que têm transação vinculada)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_target NUMERIC(12,2);
  v_rec RECORD;
  v_sum NUMERIC(12,2) := 0;
BEGIN
  SELECT "amountPaid" INTO v_target FROM installments WHERE id = 96;

  FOR v_rec IN
    SELECT id, amount
    FROM payments
    WHERE installment_id = 96
      AND lower(COALESCE(type, 'payment')) = 'payment'
      AND btrim(COALESCE(environment, ''), E' \t\r\n') = 'test'
    ORDER BY (financial_transaction_id IS NOT NULL) DESC, payment_date, id
  LOOP
    IF v_sum < COALESCE(v_target, 0) THEN
      v_sum := v_sum + COALESCE(v_rec.amount, 0);
    ELSE
      DELETE FROM payments WHERE id = v_rec.id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Parcela 96: soma mantida %, esperada %', v_sum, v_target;
END $$;

-- -----------------------------------------------------------------------------
-- 4) Estornos 113 e 122: converter o pagamento original em reversal e remover
--    o reversal duplicado, para não falsificar divergência no aceite.
--    (o evento de estorno continua existindo, com o mesmo valor)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_orig UUID;
  v_rev UUID;
BEGIN
  FOR r IN SELECT id FROM installments WHERE id IN (113, 122) LOOP
    SELECT id INTO v_rev
    FROM payments
    WHERE installment_id = r.id
      AND lower(COALESCE(type, '')) = 'reversal'
    ORDER BY payment_date DESC, id DESC
    LIMIT 1;

    SELECT id INTO v_orig
    FROM payments
    WHERE installment_id = r.id
      AND lower(COALESCE(type, 'payment')) = 'payment'
    ORDER BY payment_date, id
    LIMIT 1;

    IF v_rev IS NOT NULL AND v_orig IS NOT NULL THEN
      UPDATE payments SET type = 'reversal' WHERE id = v_orig;
      DELETE FROM payments WHERE id = v_rev;
    END IF;

    v_orig := NULL;
    v_rev := NULL;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 5) Parcelas 97, 150 e 151: criar o pagamento ausente + caixa correspondente
--    (somente se ainda não existir pagamento para a parcela)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_tx BIGINT;
BEGIN
  FOR r IN
    SELECT * FROM installments
    WHERE id IN (97, 150, 151)
      AND btrim(COALESCE(environment, ''), E' \t\r\n') = 'test'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM payments
      WHERE installment_id = r.id
        AND lower(COALESCE(type, 'payment')) = 'payment'
    ) THEN
      INSERT INTO financial_transactions (
        date, amount, type, account_id, category_id, description, environment
      ) VALUES (
        DATE '2026-03-15',
        COALESCE(r."amountPaid", 0),
        'income',
        NULL,
        NULL,
        'Ajuste de conciliação histórica - parcela ' || r.id::text,
        'test'
      ) RETURNING id INTO v_tx;

      INSERT INTO payments (
        installment_id, amount, payment_date, account_id, category_id,
        description, environment, type, financial_transaction_id
      ) VALUES (
        r.id,
        COALESCE(r."amountPaid", 0),
        DATE '2026-03-15',
        NULL,
        NULL,
        'Ajuste de conciliação histórica - parcela ' || r.id::text,
        'test',
        'payment',
        v_tx
      );
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 6) VERIFICAÇÃO FINAL (test)
-- -----------------------------------------------------------------------------
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
  'divergencias_pagamentos', (SELECT COUNT(*) FROM div),
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
) AS resultado;

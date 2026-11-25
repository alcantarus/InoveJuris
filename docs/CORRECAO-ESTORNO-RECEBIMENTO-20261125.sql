-- ============================================================================
-- CORREÇÃO — recebimento parcial em parcela estornada
-- Data: 25/11/2026
--
-- Problema:
--   Depois de estornar um recebimento (parcela fica 'Estornado' e amountPaid=0),
--   o recebimento INTEGRAL volta a funcionar (process_installment_payment não
--   bloqueia Estornado), mas o recebimento PARCIAL é recusado por
--   rpc_recebimento_com_desdobramento:
--     P0001  A parcela X não possui saldo para desdobramento (status: Estornado).
--
--   O estorno devolve o título ao aberto; logo, ele deve poder ser recebido
--   novamente, inclusive de forma parcial.
--
-- Correção:
--   rpc_recebimento_com_desdobramento passa a:
--     - bloquear Quitado / Cancelado / Cancelada (como antes);
--     - permitir Estornado/Estornada SOMENTE quando amountPaid = 0
--       (estorno limpo);
--     - continuar bloqueando Estornado com valor pago residual.
--
--   Nada mais na função muda: valores, residual, caixa e payments seguem iguais.
--
-- Escopo:
--   - CREATE OR REPLACE em rpc_recebimento_com_desdobramento.
--   - NÃO altera tabelas, dados, gatilhos, policies, grants ou o front.
--   - Backup da definição atual em backup_recebimento_desdobramento_20261125.
--
-- Observação: o agente não executa SQL. Este script é para você rodar.
-- ============================================================================

BEGIN;

-- 1) Backup da definição atual ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.backup_recebimento_desdobramento_20261125 (
  objeto        TEXT PRIMARY KEY,
  definicao     TEXT,
  capturado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.backup_recebimento_desdobramento_20261125 (objeto, definicao)
SELECT 'function:rpc_recebimento_com_desdobramento(' ||
       pg_get_function_identity_arguments(p.oid) || ')',
       pg_get_functiondef(p.oid)
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace
   AND p.proname = 'rpc_recebimento_com_desdobramento'
ON CONFLICT (objeto) DO UPDATE
   SET definicao = EXCLUDED.definicao,
       capturado_em = now();

-- 2) Pré-validação: aborta se a função não estiver na versão esperada -------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'rpc_recebimento_com_desdobramento'
       AND (pg_get_functiondef(p.oid) LIKE '%v7 20261121%'
            OR pg_get_functiondef(p.oid) LIKE '%v8 20261125%')
       AND (pg_get_functiondef(p.oid) LIKE '%estornado%'
            OR pg_get_functiondef(p.oid) LIKE '%v8 20261125%')
  ) THEN
    RAISE EXCEPTION
      'Abortado: rpc_recebimento_com_desdobramento não está na versão v7/v8 esperada.';
  END IF;
END $$;

-- 3) Função corrigida -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_recebimento_com_desdobramento(
  p_installment_id bigint,
  p_valor_principal_pago numeric,
  p_valor_juros numeric,
  p_valor_multa numeric,
  p_account_id bigint,
  p_category_id bigint,
  p_date date,
  p_description text,
  p_user_id bigint
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_installment RECORD;
  v_saldo_atual NUMERIC(12,2);
  v_novo_saldo NUMERIC(12,2);
  v_total_pago NUMERIC(12,2);
  v_total_acumulado NUMERIC(12,2);
  v_nova_parcela_id BIGINT;
  v_pagamento_id UUID;
  v_tx_id BIGINT;
  v_numero_novo INTEGER;
  v_status TEXT;
BEGIN
  -- v8 20261125 — estorno devolve o título ao aberto; permite novo recebimento
  -- (inclusive parcial) quando o valor pago é zero.

  IF p_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    p_user_id := NULL;
  END IF;

  SELECT * INTO v_installment
    FROM installments
   WHERE id = p_installment_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela % não encontrada.', p_installment_id;
  END IF;

  v_status := lower(btrim(COALESCE(v_installment.status, '')));

  IF v_status IN ('quitado', 'cancelado', 'cancelada') THEN
    RAISE EXCEPTION 'A parcela % não possui saldo para desdobramento (status: %).',
      p_installment_id, v_installment.status;
  END IF;

  -- Estorno limpo (amountPaid = 0) devolve o título ao aberto e pode ser
  -- recebido de novo. Estorno com valor pago residual exige regularização.
  IF v_status IN ('estornado', 'estornada')
     AND COALESCE(v_installment."amountPaid", 0) > 0 THEN
    RAISE EXCEPTION 'A parcela % está estornada com valor pago residual (%). Regularize antes de receber.',
      p_installment_id, v_installment."amountPaid";
  END IF;

  IF p_valor_principal_pago IS NULL OR p_valor_principal_pago <= 0 THEN
    RAISE EXCEPTION 'O valor principal pago deve ser maior que zero.';
  END IF;

  -- saldo realmente devido, descontando pagamento anterior
  v_saldo_atual := COALESCE(v_installment.amount, 0)
                 - COALESCE(v_installment."amountPaid", 0);

  IF v_saldo_atual <= 0 THEN
    RAISE EXCEPTION 'A parcela % não possui saldo em aberto.', p_installment_id;
  END IF;

  IF p_valor_principal_pago >= v_saldo_atual THEN
    RAISE EXCEPTION 'O valor principal pago (%) deve ser estritamente menor que o saldo devedor da parcela (%). Para pagamentos integrais, utilize a baixa total.',
      p_valor_principal_pago, v_saldo_atual;
  END IF;

  v_novo_saldo := v_saldo_atual - p_valor_principal_pago;
  v_total_pago := p_valor_principal_pago
                + COALESCE(p_valor_juros, 0)
                + COALESCE(p_valor_multa, 0);
  v_total_acumulado := COALESCE(v_installment."amountPaid", 0) + v_total_pago;

  -- número novo, sem colidir com parcelas já existentes do contrato
  SELECT COALESCE(MAX("installmentNumber"), 0) + 1
    INTO v_numero_novo
    FROM installments
   WHERE contract_id = v_installment.contract_id;

  -- parcela original: preserva amount e ACUMULA o total pago
  UPDATE installments
     SET "amountPaid" = v_total_acumulado,
         interest = COALESCE(interest, 0) + COALESCE(p_valor_juros, 0),
         fine = COALESCE(fine, 0) + COALESCE(p_valor_multa, 0),
         status = 'Quitado',
         updated_by = p_user_id
   WHERE id = p_installment_id;

  -- residual com numeração nova, sobre o saldo devedor
  INSERT INTO installments (
      contract_id, "installmentNumber", "dueDate", amount, "amountPaid",
      status, interest, fine, environment, created_by, updated_by
  ) VALUES (
      v_installment.contract_id, v_numero_novo, v_installment."dueDate",
      v_novo_saldo, 0, 'Aberto', 0, 0, v_installment.environment, p_user_id, p_user_id
  ) RETURNING id INTO v_nova_parcela_id;

  -- caixa (exatamente um lançamento)
  INSERT INTO financial_transactions (
      date, amount, type, account_id, category_id, description, environment, created_by
  ) VALUES (
      p_date, v_total_pago, 'income', p_account_id, p_category_id,
      p_description, v_installment.environment, p_user_id
  ) RETURNING id INTO v_tx_id;

  -- histórico de pagamento, vinculado à transação (o gatilho v4 recalcula o contrato)
  INSERT INTO payments (
      installment_id, amount, payment_date, account_id, category_id,
      description, environment, type, created_by, financial_transaction_id
  ) VALUES (
      p_installment_id, v_total_pago, p_date, p_account_id, p_category_id,
      p_description, v_installment.environment, 'payment', p_user_id, v_tx_id
  ) RETURNING id INTO v_pagamento_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Desdobramento realizado com sucesso.',
    'parcela_original_id', p_installment_id,
    'nova_parcela_id', v_nova_parcela_id,
    'pagamento_id', v_pagamento_id::text,
    'transacao_id', v_tx_id,
    'valor_remanescente', v_novo_saldo,
    'numero_novo', v_numero_novo,
    'saldo_anterior', v_saldo_atual,
    'total_pago_acumulado', v_total_acumulado
  );
END;
$function$;

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO (último resultset)
-- ============================================================================
SELECT jsonb_build_object(
  'backup_objetos', (
    SELECT COUNT(*) FROM public.backup_recebimento_desdobramento_20261125
  ),
  'rpc_recebimento_com_desdobramento_v8', EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'rpc_recebimento_com_desdobramento'
       AND pg_get_functiondef(p.oid) LIKE '%v8 20261125%'
       AND pg_get_functiondef(p.oid) LIKE '%valor pago residual%'
  ),
  'ainda_bloqueia_quitado_cancelado', EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = 'rpc_recebimento_com_desdobramento'
       AND pg_get_functiondef(p.oid) LIKE '%''quitado'', ''cancelado'', ''cancelada''%'
  )
) AS correcao_estorno_recebimento;

-- ============================================================================
-- ROLLBACK (usar somente se necessário)
-- ============================================================================
-- BEGIN;
-- DO $$
-- DECLARE
--   r RECORD;
-- BEGIN
--   FOR r IN
--     SELECT definicao
--       FROM public.backup_recebimento_desdobramento_20261125
--      WHERE objeto LIKE 'function:%'
--      ORDER BY capturado_em
--   LOOP
--     EXECUTE r.definicao;
--   END LOOP;
-- END $$;
-- COMMIT;

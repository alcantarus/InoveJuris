-- ============================================================================
-- Recebimento com forma de pagamento por parcela
-- Data: 22/11/2026
--
-- Objetivo:
--   1. Guardar a forma de pagamento em cada pagamento e em cada transação.
--   2. Permitir que o recebimento em lote informe conta/forma por parcela.
--
-- Escopo:
--   - Adiciona colunas anuláveis (registros antigos ficam NULL).
--   - Cria uma RPC de apoio que CHAMA a função canônica já existente:
--       * process_installment_payment(...)          -> pagamento integral
--       * rpc_recebimento_com_desdobramento(...)    -> pagamento parcial
--     A lógica financeira canônica NÃO é reescrita.
--
-- Ordem de aplicação:
--   1. Rodar este script em HOMOLOGAÇÃO (test).
--   2. Validar o recebimento individual e o assistente em lote.
--   3. Só depois aplicar em produção.
--
-- Observação: o agente não executa SQL. Este script é para você rodar.
-- ============================================================================

BEGIN;

-- 1. Colunas de forma de pagamento -------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

COMMENT ON COLUMN public.payments.payment_method IS
  'Forma de pagamento usada neste recebimento (Dinheiro, PIX, Cartão etc.).';
COMMENT ON COLUMN public.financial_transactions.payment_method IS
  'Forma de pagamento da movimentação de caixa correspondente ao recebimento.';

-- 2. Lista controlada de formas de pagamento ---------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_payment_method_check'
      AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_payment_method_check
      CHECK (
        payment_method IS NULL OR payment_method IN (
          'Dinheiro',
          'PIX',
          'Cartão de Crédito',
          'Cartão de Débito',
          'Transferência',
          'Boleto',
          'Cheque',
          'Outro'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financial_transactions_payment_method_check'
      AND conrelid = 'public.financial_transactions'::regclass
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD CONSTRAINT financial_transactions_payment_method_check
      CHECK (
        payment_method IS NULL OR payment_method IN (
          'Dinheiro',
          'PIX',
          'Cartão de Crédito',
          'Cartão de Débito',
          'Transferência',
          'Boleto',
          'Cheque',
          'Outro'
        )
      );
  END IF;
END $$;

-- 3. RPC de apoio ------------------------------------------------------------
-- Chama a função canônica e depois grava a forma de pagamento no pagamento e
-- na transação recém-criados. Não duplica a lógica de status/saldo/contrato.
CREATE OR REPLACE FUNCTION public.rpc_receber_parcela_com_metodo(
  p_installment_id BIGINT,
  p_amount_paid DECIMAL(12,2),
  p_date DATE,
  p_description TEXT,
  p_account_id BIGINT,
  p_category_id BIGINT,
  p_payment_method TEXT,
  p_user_id BIGINT,
  p_interest DECIMAL(12,2) DEFAULT 0,
  p_fine DECIMAL(12,2) DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_installment RECORD;
  v_saldo DECIMAL(12,2);
  v_is_partial BOOLEAN;
  v_result JSONB;
  v_payment_id BIGINT;
  v_tx_id BIGINT;
BEGIN
  -- Bloqueia a parcela para evitar recebimento concorrente.
  SELECT * INTO v_installment
  FROM public.installments
  WHERE id = p_installment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela % não encontrada.', p_installment_id;
  END IF;

  IF p_amount_paid IS NULL OR p_amount_paid <= 0 THEN
    RAISE EXCEPTION 'Informe um valor maior que zero.';
  END IF;

  IF p_payment_method IS NULL OR btrim(p_payment_method) = '' THEN
    RAISE EXCEPTION 'Informe a forma de pagamento.';
  END IF;

  IF p_payment_method NOT IN (
    'Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito',
    'Transferência', 'Boleto', 'Cheque', 'Outro'
  ) THEN
    RAISE EXCEPTION 'Forma de pagamento inválida: %', p_payment_method;
  END IF;

  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'Informe a conta de destino.';
  END IF;

  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'Informe a categoria.';
  END IF;

  v_saldo := (v_installment.amount - COALESCE(v_installment."amountPaid", 0));

  IF p_amount_paid > v_saldo + 0.01 THEN
    RAISE EXCEPTION 'O valor (%) é maior que o saldo da parcela (%).',
      p_amount_paid, v_saldo;
  END IF;

  v_is_partial := p_amount_paid < v_saldo - 0.01;

  IF v_is_partial THEN
    -- Pagamento parcial: mantém o desdobramento canônico.
    v_result := public.rpc_recebimento_com_desdobramento(
      p_installment_id => p_installment_id,
      p_valor_principal_pago => p_amount_paid,
      p_valor_juros => p_interest,
      p_valor_multa => p_fine,
      p_account_id => p_account_id,
      p_category_id => p_category_id,
      p_date => p_date,
      p_description => p_description,
      p_user_id => p_user_id
    );
  ELSE
    -- Pagamento integral: mantém a baixa canônica.
    v_result := public.process_installment_payment(
      p_installment_id => p_installment_id,
      p_amount_paid => p_amount_paid,
      p_account_id => p_account_id,
      p_category_id => p_category_id,
      p_date => p_date,
      p_description => p_description,
      p_user_id => p_user_id,
      p_interest => p_interest,
      p_fine => p_fine
    );
  END IF;

  -- Localiza o pagamento recém-criado. O filtro por data/valor reduz o risco
  -- de atingir um pagamento anterior da mesma parcela.
  SELECT id INTO v_payment_id
  FROM public.payments
  WHERE installment_id = p_installment_id
    AND type = 'payment'
    AND payment_date = p_date
    AND amount = p_amount_paid
  ORDER BY id DESC
  LIMIT 1;

  IF v_payment_id IS NOT NULL THEN
    UPDATE public.payments
       SET payment_method = p_payment_method
     WHERE id = v_payment_id;

    SELECT financial_transaction_id INTO v_tx_id
    FROM public.payments
    WHERE id = v_payment_id;
  END IF;

  -- Fallback para bases em que a RPC canônica ainda não preenche
  -- payments.financial_transaction_id.
  IF v_tx_id IS NULL THEN
    SELECT id INTO v_tx_id
    FROM public.financial_transactions
    WHERE account_id = p_account_id
      AND category_id = p_category_id
      AND date = p_date
      AND amount = p_amount_paid
      AND type = 'income'
      AND environment = v_installment.environment
    ORDER BY id DESC
    LIMIT 1;
  END IF;

  IF v_tx_id IS NOT NULL THEN
    UPDATE public.financial_transactions
       SET payment_method = p_payment_method
     WHERE id = v_tx_id;
  END IF;

  RETURN COALESCE(v_result, '{}'::jsonb) || jsonb_build_object(
    'payment_method', p_payment_method,
    'payment_id', v_payment_id,
    'financial_transaction_id', v_tx_id
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_receber_parcela_com_metodo(
  BIGINT, NUMERIC, DATE, TEXT, BIGINT, BIGINT, TEXT, BIGINT, NUMERIC, NUMERIC
) IS
  'Recebe uma parcela (integral ou parcial) usando a RPC canônica e grava a forma de pagamento.';

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO (rodar depois do COMMIT)
-- ============================================================================
SELECT jsonb_build_object(
  'payments_payment_method', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name = 'payment_method'
  ),
  'financial_transactions_payment_method', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_transactions'
      AND column_name = 'payment_method'
  ),
  'rpc_receber_parcela_com_metodo', EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'rpc_receber_parcela_com_metodo'
  )
) AS verificacao_recebimento_metodo_pagamento;

-- ============================================================================
-- ROLLBACK (usar somente se necessário; apaga a forma de pagamento já gravada)
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.rpc_receber_parcela_com_metodo(
--   BIGINT, NUMERIC, DATE, TEXT, BIGINT, BIGINT, TEXT, BIGINT, NUMERIC, NUMERIC
-- );
-- ALTER TABLE public.payments DROP COLUMN IF EXISTS payment_method;
-- ALTER TABLE public.financial_transactions DROP COLUMN IF EXISTS payment_method;
-- COMMIT;

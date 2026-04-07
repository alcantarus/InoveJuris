-- 1. Atualizar a função de estorno para DELETAR a transação original em vez de criar uma despesa
CREATE OR REPLACE FUNCTION process_installment_estorno(
  p_installment_id BIGINT,
  p_reason TEXT,
  p_account_id BIGINT,
  p_user_id BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_installment RECORD;
  v_contract_id BIGINT;
  v_amount_to_reverse DECIMAL(12,2);
  v_new_received DECIMAL(12,2);
  v_new_receivable DECIMAL(12,2);
  v_contract_value DECIMAL(12,2);
  v_new_status TEXT;
  v_all_paid BOOLEAN;
  v_some_paid BOOLEAN;
  v_has_estornado BOOLEAN;
  v_old_obs TEXT;
  v_payment RECORD;
BEGIN
  -- Validação de segurança para p_user_id (evitar violação de FK se o ID for inválido)
  IF p_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    p_user_id := NULL;
  END IF;

  -- 1. Get installment and contract info
  SELECT * INTO v_installment FROM installments WHERE id = p_installment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;
  
  IF v_installment."amountPaid" <= 0 THEN
    RAISE EXCEPTION 'Esta parcela não possui valor pago para estornar';
  END IF;

  v_contract_id := v_installment.contract_id;
  SELECT "contractValue", observations INTO v_contract_value, v_old_obs FROM contracts WHERE id = v_contract_id;
  v_amount_to_reverse := v_installment."amountPaid";

  -- 2. Update installment
  UPDATE installments 
  SET status = 'Estornado', 
      "amountPaid" = 0,
      interest = 0,
      fine = 0,
      updated_by = p_user_id
  WHERE id = p_installment_id;

  -- 3. Find the original payment record to delete the corresponding financial transaction
  SELECT * INTO v_payment FROM payments 
  WHERE installment_id = p_installment_id AND type = 'payment' 
  ORDER BY payment_date DESC LIMIT 1;

  IF FOUND THEN
    -- Delete the corresponding financial transaction (income)
    -- The trigger update_account_balance will automatically subtract the amount from the bank account
    DELETE FROM financial_transactions 
    WHERE id IN (
      SELECT id FROM financial_transactions 
      WHERE amount = v_payment.amount 
        AND date = v_payment.payment_date 
        AND account_id = v_payment.account_id 
        AND type = 'income'
        AND environment = v_installment.environment
      ORDER BY id DESC LIMIT 1
    );
  END IF;

  -- 4. Create reversal payment record (keep history in payments table)
  INSERT INTO payments (
    installment_id, amount, type, payment_date, account_id, description, environment, created_by
  ) VALUES (
    p_installment_id, v_amount_to_reverse, 'reversal', CURRENT_DATE, p_account_id, 'Estorno: ' || p_reason, v_installment.environment, p_user_id
  );

  -- 5. Update contract totals and status
  SELECT COALESCE(SUM("amountPaid"), 0) INTO v_new_received FROM installments WHERE contract_id = v_contract_id;
  v_new_receivable := GREATEST(0, v_contract_value - v_new_received);
  
  SELECT 
    bool_and(status IN ('Quitado', 'Cancelado')) AND bool_or(status = 'Quitado'),
    bool_or("amountPaid" > 0),
    bool_or(status = 'Estornado')
  INTO v_all_paid, v_some_paid, v_has_estornado
  FROM installments 
  WHERE contract_id = v_contract_id;

  IF v_has_estornado THEN
    v_new_status := 'Estornado';
  ELSIF v_all_paid THEN
    v_new_status := 'Quitado';
  ELSIF v_some_paid THEN
    v_new_status := 'Parcial';
  ELSE
    v_new_status := 'Aberto';
  END IF;

  UPDATE contracts 
  SET "amountReceived" = v_new_received, 
      "amountReceivable" = v_new_receivable,
      status = v_new_status,
      observations = COALESCE(v_old_obs, '') || E'\n' || '[ESTORNO]: ' || p_reason,
      updated_by = p_user_id
  WHERE id = v_contract_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_received', v_new_received,
    'new_receivable', v_new_receivable,
    'new_status', v_new_status
  );
END;
$$ LANGUAGE plpgsql;

-- 2. Limpar as transações de estorno existentes e suas transações de entrada correspondentes
DO $$
DECLARE
  v_estorno RECORD;
BEGIN
  -- Para cada transação de estorno (despesa)
  FOR v_estorno IN 
    SELECT * FROM financial_transactions 
    WHERE type = 'expense' AND description LIKE 'ESTORNO:%'
  LOOP
    -- Encontrar o pagamento original correspondente (mesmo valor, mesma conta, mesmo ambiente)
    -- Deletar a transação de entrada com o mesmo valor, conta e ambiente
    DELETE FROM financial_transactions 
    WHERE id IN (
      SELECT id FROM financial_transactions 
      WHERE amount = v_estorno.amount 
        AND account_id = v_estorno.account_id 
        AND type = 'income'
        AND environment = v_estorno.environment
        -- A data da entrada deve ser menor ou igual à data do estorno
        AND date <= v_estorno.date
      ORDER BY date DESC LIMIT 1
    );
    
    -- Deletar a transação de estorno (despesa)
    DELETE FROM financial_transactions WHERE id = v_estorno.id;
  END LOOP;
END;
$$;

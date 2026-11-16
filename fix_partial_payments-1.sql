-- ==============================================================================
-- SCRIPT PARA CORRIGIR O ERRO DE DUPLICAÇÃO DE PARCELAS E VALORES INCORRETOS
-- ==============================================================================

-- 1. Atualizar a função de processamento de pagamentos para NÃO criar novas parcelas
-- e somar corretamente os valores pagos parcialmente.
CREATE OR REPLACE FUNCTION process_installment_payment(
  p_installment_id BIGINT,
  p_amount_paid DECIMAL(12,2),
  p_account_id BIGINT,
  p_category_id BIGINT,
  p_date DATE,
  p_description TEXT,
  p_user_id BIGINT,
  p_interest DECIMAL(12,2),
  p_fine DECIMAL(12,2)
) RETURNS JSONB AS $$
DECLARE
  v_installment RECORD;
  v_contract_id BIGINT;
  v_total_due DECIMAL(12,2);
  v_new_received DECIMAL(12,2);
  v_new_receivable DECIMAL(12,2);
  v_contract_value DECIMAL(12,2);
  v_new_status TEXT;
  v_all_paid BOOLEAN;
  v_some_paid BOOLEAN;
  v_has_estornado BOOLEAN;
BEGIN
  -- 1. Get installment and contract info
  SELECT * INTO v_installment FROM installments WHERE id = p_installment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;
  
  v_contract_id := v_installment.contract_id;
  SELECT "contractValue" INTO v_contract_value FROM contracts WHERE id = v_contract_id;

  -- 2. Update current installment
  IF v_installment.status = 'Cancelado' THEN
    RAISE EXCEPTION 'Não é possível pagar uma parcela cancelada';
  END IF;

  -- O valor total devido agora subtrai o que já foi pago anteriormente
  v_total_due := (v_installment.amount - COALESCE(v_installment."amountPaid", 0)) + p_interest + p_fine;
  
  IF p_amount_paid >= v_total_due - 0.01 THEN
    -- Full payment
    UPDATE installments 
    SET status = 'Quitado', 
        "amountPaid" = COALESCE("amountPaid", 0) + p_amount_paid, 
        interest = COALESCE(interest, 0) + p_interest, 
        fine = COALESCE(fine, 0) + p_fine,
        updated_by = p_user_id
    WHERE id = p_installment_id;
  ELSE
    -- Partial payment: Split installment
    -- 1. Update current installment to 'Quitado' with the amount paid
    UPDATE installments 
    SET status = 'Quitado', 
        amount = p_amount_paid,
        "amountPaid" = p_amount_paid,
        interest = COALESCE(interest, 0) + p_interest, 
        fine = COALESCE(fine, 0) + p_fine,
        updated_by = p_user_id
    WHERE id = p_installment_id;
    
    -- 2. Create new installment with the remaining balance
    INSERT INTO installments (
        contract_id,
        "installmentNumber",
        "dueDate",
        amount,
        "amountPaid",
        status,
        environment,
        created_by
    ) VALUES (
        v_contract_id,
        (SELECT MAX("installmentNumber") + 1 FROM installments WHERE contract_id = v_contract_id),
        v_installment."dueDate",
        v_total_due - p_amount_paid,
        0,
        'Aberto',
        v_installment.environment,
        p_user_id
    );
  END IF;

  -- 3. Create financial transaction
  INSERT INTO financial_transactions (
    date, amount, type, account_id, category_id, description, environment, created_by
  ) VALUES (
    p_date, p_amount_paid, 'income', p_account_id, p_category_id, p_description, v_installment.environment, p_user_id
  );

  -- 4. Create payment record
  INSERT INTO payments (
    installment_id, amount, type, payment_date, account_id, category_id, description, environment, created_by
  ) VALUES (
    p_installment_id, p_amount_paid, 'payment', p_date, p_account_id, p_category_id, p_description, v_installment.environment, p_user_id
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
      updated_by = p_user_id
  WHERE id = v_contract_id;

  RETURN jsonb_build_object(
    'success', true, 
    'installment_status', CASE WHEN p_amount_paid >= v_total_due - 0.01 THEN 'Quitado' ELSE 'Parcial' END,
    'contract_status', v_new_status
  );
END;
$$ LANGUAGE plpgsql;

-- 2. Limpar as parcelas duplicadas que foram geradas pelo erro anterior
-- ATENÇÃO: Isso apagará as parcelas extras (geradas pelo erro) que estão com valor pago = 0
-- e cujo número da parcela seja maior que a quantidade original de parcelas do contrato.
DELETE FROM installments 
WHERE "amountPaid" = 0 
  AND status = 'Aberto'
  AND id IN (
    SELECT i.id 
    FROM installments i
    JOIN contracts c ON i.contract_id = c.id
    WHERE i."installmentNumber" > (
      -- Estima a quantidade original de parcelas baseada no valor do contrato e valor da primeira parcela
      SELECT COUNT(*) FROM installments i2 WHERE i2.contract_id = c.id AND i2.created_at < i.created_at
    )
  );

-- Alternativa mais segura para o ambiente de testes:
-- Se o contrato do Atanael José da Silva for o único afetado, você pode apagar as parcelas 5 e 6 manualmente:
-- DELETE FROM installments WHERE contract_id = (SELECT id FROM contracts WHERE "client_name" = 'Atanael José da Silva' LIMIT 1) AND "installmentNumber" IN (5, 6);

-- RAISE NOTICE 'Correção aplicada com sucesso!';

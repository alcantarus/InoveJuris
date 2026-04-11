CREATE OR REPLACE FUNCTION process_contract_cancellation(
  p_contract_id BIGINT,
  p_reason TEXT,
  p_user_id BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_has_payments BOOLEAN;
  v_old_obs TEXT;
BEGIN
  -- 1. Check if there are any invalid installments (paid, reversed, etc.)
  -- ALERTA: Permitindo cancelamento de parcelas 'Prorrogada' desde que amountPaid = 0
  SELECT COALESCE(bool_or("amountPaid" > 0 OR status NOT IN ('Aberto', 'Atrasada', 'Prorrogada')), false) INTO v_has_payments 
  FROM installments 
  WHERE contract_id = p_contract_id;
  
  IF v_has_payments THEN
    RAISE EXCEPTION 'Não é possível cancelar um contrato com parcelas recebidas ou em status inválido.';
  END IF;

  -- 2. Update contract
  SELECT observations INTO v_old_obs FROM contracts WHERE id = p_contract_id;
  
  UPDATE contracts 
  SET status = 'Cancelado',
      observations = COALESCE(v_old_obs, '') || E'\n\n' || '[CANCELAMENTO]: ' || p_reason,
      updated_by = p_user_id
  WHERE id = p_contract_id;

  -- 3. Update all installments
  UPDATE installments 
  SET status = 'Cancelada',
      updated_by = p_user_id
  WHERE contract_id = p_contract_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

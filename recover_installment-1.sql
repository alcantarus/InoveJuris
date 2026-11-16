-- ==============================================================================
-- SCRIPT PARA RECUPERAR A PARCELA 4 QUE FOI EXCLUÍDA ACIDENTALMENTE
-- ==============================================================================

-- Este script recria a parcela 4 do contrato do "Atanael José da Silva"
-- que foi excluída pelo script de limpeza anterior.

DO $$
DECLARE
  v_contract_id BIGINT;
  v_env TEXT := 'test';
BEGIN
  -- 1. Encontrar o ID do contrato
  SELECT id INTO v_contract_id 
  FROM contracts 
  WHERE "client_name" = 'Atanael José da Silva' 
    AND environment = v_env
  LIMIT 1;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado no ambiente de testes.';
  END IF;

  -- 2. Verificar se a parcela 4 já existe para evitar duplicação
  IF NOT EXISTS (
    SELECT 1 FROM installments 
    WHERE contract_id = v_contract_id 
      AND "installmentNumber" = 4
  ) THEN
    -- 3. Inserir a parcela 4
    INSERT INTO installments (
      contract_id, 
      "installmentNumber", 
      "dueDate", 
      amount, 
      "amountPaid", 
      status, 
      environment
    ) VALUES (
      v_contract_id, 
      4, 
      '2026-07-15', -- Data de vencimento baseada no padrão (15/07/2026)
      2500.00,      -- Valor da parcela
      0.00,         -- Valor pago
      'Aberto',     -- Status
      v_env         -- Ambiente
    );
    RAISE NOTICE 'Parcela 4 recriada com sucesso!';
  ELSE
    RAISE NOTICE 'A parcela 4 já existe para este contrato.';
  END IF;

  -- 4. Atualizar os totais do contrato para garantir que estejam corretos
  UPDATE contracts c
  SET 
    "amountReceived" = (SELECT COALESCE(SUM("amountPaid"), 0) FROM installments WHERE contract_id = c.id),
    "amountReceivable" = GREATEST(0, "contractValue" - (SELECT COALESCE(SUM("amountPaid"), 0) FROM installments WHERE contract_id = c.id))
  WHERE id = v_contract_id;

END;
$$ LANGUAGE plpgsql;

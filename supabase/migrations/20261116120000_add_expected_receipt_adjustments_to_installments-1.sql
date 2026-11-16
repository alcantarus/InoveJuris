-- Ajuste de data prevista de recebimento em parcelas (Contas a Receber)
-- Mantém a data contratual/original e registra motivo do ajuste (ex.: decisão judicial, deferimento INSS)

ALTER TABLE installments ADD COLUMN IF NOT EXISTS original_due_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS due_date_reason TEXT;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS due_date_adjusted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS due_date_adjusted_by BIGINT;

-- Preenche data original quando ausente.
-- Evita parcelas quitadas/pagas/canceladas e parcelas de contratos protegidos (quitado/cancelado),
-- pois gatilhos de recálculo podem tentar alterar o contrato e serem bloqueados.
UPDATE installments i
SET original_due_date = i."dueDate"
WHERE i.original_due_date IS NULL
  AND i."dueDate" IS NOT NULL
  AND COALESCE(i.status, '') NOT IN ('Quitado', 'Cancelada')
  AND COALESCE(i."amountPaid", 0) < COALESCE(i.amount, 0)
  AND NOT EXISTS (
    SELECT 1
    FROM contracts c
    WHERE c.id = i.contract_id
      AND COALESCE(c.status, '') IN ('Quitado', 'Cancelado')
  );

COMMENT ON COLUMN installments.original_due_date IS 'Data de vencimento/prevista original da parcela';
COMMENT ON COLUMN installments.due_date_reason IS 'Motivo do ajuste da data prevista de recebimento';
COMMENT ON COLUMN installments.due_date_adjusted_at IS 'Data/hora em que a previsão foi ajustada';
COMMENT ON COLUMN installments.due_date_adjusted_by IS 'Usuário que ajustou a previsão';

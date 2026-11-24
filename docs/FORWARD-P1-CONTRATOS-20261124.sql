-- P1 — integridade e índices (Contratos / Contas a Receber / Fluxo de Caixa)
-- NÃO APLICAR SEM AUTORIZAÇÃO EXPLÍCITA E MEDIÇÃO PRÉVIA.
-- Pré-requisito: medicao_previa_contratos com duplicatas_parcelas = 0.
-- Nenhum UPDATE/DELETE. CONCURRENTLY foi removido: o SQL Editor do Supabase
-- roda o script dentro de uma transação (erro 25001). As tabelas têm 15 a 181
-- linhas, então CREATE INDEX normal é seguro e não causa bloqueio perceptível.

-- Unicidade de parcelas: usa índice único existente para a constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_installments_contract_number
  ON public.installments (contract_id, "installmentNumber");

DO $uq$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_installments_contract_number'
      AND conrelid = 'public.installments'::regclass
  ) THEN
    ALTER TABLE public.installments
      ADD CONSTRAINT uq_installments_contract_number
      UNIQUE USING INDEX uq_installments_contract_number;
  END IF;
END
$uq$;

-- Fluxo de Caixa / pagamentos
CREATE INDEX IF NOT EXISTS idx_payments_installment_id
  ON public.payments (installment_id);

CREATE INDEX IF NOT EXISTS idx_payments_environment
  ON public.payments (environment);

CREATE INDEX IF NOT EXISTS idx_payments_type_payment_date
  ON public.payments (type, payment_date);

-- Contas a Receber / parcelas
CREATE INDEX IF NOT EXISTS idx_installments_due_date_status
  ON public.installments ("dueDate", status);

CREATE INDEX IF NOT EXISTS idx_installments_contract_id
  ON public.installments (contract_id);

-- Comissões
CREATE INDEX IF NOT EXISTS idx_commission_payments_contract_id
  ON public.commission_payments (contract_id);

CREATE INDEX IF NOT EXISTS idx_commission_payments_indicator_id
  ON public.commission_payments (indicator_id);

NOTIFY pgrst, 'reload config';

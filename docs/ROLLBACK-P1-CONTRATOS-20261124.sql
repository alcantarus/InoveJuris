-- ROLLBACK P1 — NÃO APLICAR SEM AUTORIZAÇÃO EXPLÍCITA.
-- Remove a constraint de unicidade e os índices criados pelo FORWARD-P1.
-- Nenhum UPDATE/DELETE de dados de negócio.

ALTER TABLE public.installments
  DROP CONSTRAINT IF EXISTS uq_installments_contract_number;

DROP INDEX IF EXISTS public.uq_installments_contract_number;
DROP INDEX IF EXISTS public.idx_payments_installment_id;
DROP INDEX IF EXISTS public.idx_payments_environment;
DROP INDEX IF EXISTS public.idx_payments_type_payment_date;
DROP INDEX IF EXISTS public.idx_installments_due_date_status;
DROP INDEX IF EXISTS public.idx_installments_contract_id;
DROP INDEX IF EXISTS public.idx_commission_payments_contract_id;
DROP INDEX IF EXISTS public.idx_commission_payments_indicator_id;

NOTIFY pgrst, 'reload config';

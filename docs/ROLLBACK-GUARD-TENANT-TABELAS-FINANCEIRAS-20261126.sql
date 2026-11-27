-- ROLLBACK - guarda de tenant nas tabelas financeiras
-- 26/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Remove somente as 5 triggers zz_tenant_guard_dml e a funcao criada.
-- Nao altera nenhuma trigger preexistente.

begin;

drop trigger if exists zz_tenant_guard_dml on public.installments;
drop trigger if exists zz_tenant_guard_dml on public.payments;
drop trigger if exists zz_tenant_guard_dml on public.financial_transactions;
drop trigger if exists zz_tenant_guard_dml on public.contracts;
drop trigger if exists zz_tenant_guard_dml on public.commission_payments;

drop function if exists public._tenant_guard_dml_fn();

commit;

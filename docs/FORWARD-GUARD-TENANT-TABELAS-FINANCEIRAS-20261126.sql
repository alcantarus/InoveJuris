-- FORWARD - guarda de tenant nas tabelas financeiras
-- 26/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Cobre as RPCs de pagamento/estorno/cancelamento SEM reescrever o corpo delas.
-- Tabelas: installments, payments, financial_transactions, contracts,
-- commission_payments.
--
-- Com claim JWT: INSERT preenche organization_id quando ausente, UPDATE/DELETE
-- só aceitam registros da mesma organizacao.
-- Sem claim (service role, anon, tarefas internas): comportamento inalterado.
-- O nome zz_... garante que a trigger rode DEPOIS de trg_fill_organization_id.

begin;

do $$
declare
  t text;
begin
  foreach t in array array[
    'installments', 'payments', 'financial_transactions',
    'contracts', 'commission_payments'
  ] loop
    if not exists (
      select 1 from pg_attribute
       where attrelid = ('public.' || t)::regclass
         and attname = 'organization_id'
         and attnum > 0
         and not attisdropped
    ) then
      raise exception 'Abortado: tabela public.% sem coluna organization_id', t;
    end if;

    if exists (
      select 1 from pg_trigger
       where tgrelid = ('public.' || t)::regclass
         and tgname = 'zz_tenant_guard_dml'
         and not tgisinternal
    ) then
      raise exception 'Abortado: trigger zz_tenant_guard_dml ja existe em public.%', t;
    end if;
  end loop;
end $$;

create or replace function public._tenant_guard_dml_fn()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_org uuid := public._tenant_claim_organization_id();
begin
  if v_org is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.organization_id is distinct from v_org then
      raise exception 'Operação bloqueada: registro pertence a outra organização.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if new.organization_id is null then
    new.organization_id := v_org;
  elsif new.organization_id is distinct from v_org then
    raise exception 'Operação bloqueada: registro pertence a outra organização.'
      using errcode = '42501';
  end if;

  return new;
end $$;

revoke all on function public._tenant_guard_dml_fn() from public;
grant execute on function public._tenant_guard_dml_fn() to anon, authenticated, service_role;

create trigger zz_tenant_guard_dml
  before insert or update or delete on public.installments
  for each row execute function public._tenant_guard_dml_fn();

create trigger zz_tenant_guard_dml
  before insert or update or delete on public.payments
  for each row execute function public._tenant_guard_dml_fn();

create trigger zz_tenant_guard_dml
  before insert or update or delete on public.financial_transactions
  for each row execute function public._tenant_guard_dml_fn();

create trigger zz_tenant_guard_dml
  before insert or update or delete on public.contracts
  for each row execute function public._tenant_guard_dml_fn();

create trigger zz_tenant_guard_dml
  before insert or update or delete on public.commission_payments
  for each row execute function public._tenant_guard_dml_fn();

commit;

-- FORWARD - tenant na RPC app_register_commission_payment
-- 26/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Diagnostico 20:23Z: SECURITY DEFINER, hash 76f9b818d62ac7f0dde005ada25d48c3,
-- sem organization_id e sem leitura de claim.
-- Reutiliza o helper _tenant_claim_organization_id().
-- Salva o corpo original na mesma tabela de backup antes de substituir.

begin;

do $$
declare
  v_count integer;
begin
  if to_regprocedure('public._tenant_claim_organization_id()') is null then
    raise exception 'Abortado: helper _tenant_claim_organization_id ausente.';
  end if;

  select count(*) into v_count
    from public._tenant_rpc_backup_20261126
   where nome = 'app_register_commission_payment';

  if v_count = 0 then
    insert into public._tenant_rpc_backup_20261126 (nome, assinatura, hash_def, def)
    select p.proname,
           pg_get_function_identity_arguments(p.oid),
           md5(pg_get_functiondef(p.oid)),
           pg_get_functiondef(p.oid)
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = 'app_register_commission_payment';
  elsif v_count <> 1 then
    raise exception 'Abortado: backup duplicado de app_register_commission_payment (%)', v_count;
  end if;

  if not exists (
    select 1 from public._tenant_rpc_backup_20261126
     where nome = 'app_register_commission_payment'
       and hash_def = '76f9b818d62ac7f0dde005ada25d48c3'
  ) then
    raise exception 'Abortado: definicao viva divergiu do diagnostico 20:23Z';
  end if;
end $$;

create or replace function public.app_register_commission_payment(
  p_contract_id bigint,
  p_indicator_id bigint,
  p_amount numeric,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_env       text := public._rls_environment();
  v_org       uuid := public._tenant_claim_organization_id();
  v_indicator bigint;
  v_total     numeric;
  v_paid      numeric;
  v_balance   numeric;
  v_payment_id uuid;
begin
  if v_env is null or v_env not in ('production', 'test') then
    raise exception 'Sessão inválida ou sem ambiente definido';
  end if;

  if v_org is null then
    raise exception 'Organização da sessão não encontrada.' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor válido';
  end if;

  select c.indicator_id,
         coalesce(c.base_comissao, 0) * coalesce(c."commissionPercent", 0) / 100.0
    into v_indicator, v_total
    from public.contracts c
   where c.id = p_contract_id
     and c.organization_id = v_org
   for update;

  if not found then
    raise exception 'Contrato não encontrado nesta organização';
  end if;

  if v_indicator is distinct from p_indicator_id then
    raise exception 'Este contrato não pertence ao indicador selecionado';
  end if;

  select coalesce(sum(cp.amount_paid), 0)
    into v_paid
    from public.commission_payments cp
   where cp.contract_id = p_contract_id
     and cp.environment = v_env
     and cp.organization_id = v_org;

  v_balance := v_total - v_paid;

  if p_amount > v_balance then
    raise exception 'O valor pago (R$ %) não pode ser maior que o saldo devedor (R$ %)',
      round(p_amount, 2), round(v_balance, 2);
  end if;

  insert into public.commission_payments
    (contract_id, indicator_id, amount_paid, description, environment, organization_id)
  values
    (p_contract_id, p_indicator_id, p_amount,
     nullif(btrim(coalesce(p_description, '')), ''), v_env, v_org)
  returning id into v_payment_id;

  select coalesce(sum(cp.amount_paid), 0)
    into v_paid
    from public.commission_payments cp
   where cp.contract_id = p_contract_id
     and cp.environment = v_env
     and cp.organization_id = v_org;

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'total_paid', v_paid,
    'remaining_balance', v_total - v_paid
  );
end;
$$;

commit;

-- ============================================================================
-- FORWARD — gatilho fn_recalculate_contract_totals v5
-- 27/11/2026 — PREPARADO, NÃO EXECUTADO
--
-- Troca o cálculo de amountReceivable de "soma de parcelas em aberto" para
-- "valor do contrato - recebido". Isso elimina a duplicidade em cadeias
-- legadas sem vínculo. NÃO altera dados de contratos; para isso existe o
-- FORWARD-DADOS-RECEIVABLE-20261127.sql (somente com autorização).
-- ============================================================================

begin;

create table if not exists public.backup_func_recalculate_receivable_20261127 (
  id int primary key,
  definition text not null,
  created_at timestamptz not null default now()
);

insert into public.backup_func_recalculate_receivable_20261127 (id, definition)
select 1, pg_get_functiondef('public.fn_recalculate_contract_totals()'::regprocedure)
on conflict (id) do nothing;

do $guard$
begin
  if not exists (select 1 from public.backup_func_recalculate_receivable_20261127 where id = 1) then
    raise exception 'Abortado: backup da função não foi gravado.';
  end if;

  if exists (
    select 1 from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = 'fn_recalculate_contract_totals'
       and pg_get_functiondef(p.oid) like '%v5 20261127%'
  ) then
    raise exception 'Abortado: gatilho v5 já está aplicado.';
  end if;
end
$guard$;

create or replace function public.fn_recalculate_contract_totals()
returns trigger
language plpgsql
as $function$
declare
  v_contract_id bigint;
  v_received numeric(12,2);
  v_open numeric(12,2);
  v_current text;
  v_contract_value numeric(12,2);
  v_is_pro_bono boolean;
  v_new_status text;
  v_all_cancelled boolean;
  v_has_estornado boolean;
  v_has_prorrogada boolean;
begin
  -- v5 20261127 — recebível = valor do contrato - soma do pago.
  -- Mantidos os rótulos do contrato: Estornado/Prorrogado/Parcial/Quitado.

  if tg_op = 'DELETE' then
    if to_jsonb(old) ? 'contract_id' then
      v_contract_id := old.contract_id;
    elsif to_jsonb(old) ? 'installment_id' then
      select contract_id into v_contract_id
        from installments
       where id = old.installment_id;
    end if;
  else
    if to_jsonb(new) ? 'contract_id' then
      v_contract_id := new.contract_id;
    elsif to_jsonb(new) ? 'installment_id' then
      select contract_id into v_contract_id
        from installments
       where id = new.installment_id;
    end if;
  end if;

  if v_contract_id is null then
    return null;
  end if;

  select status, "isProBono", "contractValue"
    into v_current, v_is_pro_bono, v_contract_value
    from contracts
   where id = v_contract_id
     for update;

  select
    coalesce(sum("amountPaid"), 0),
    coalesce(count(*) > 0 and bool_and(lower(status) in ('cancelado','cancelada')), false),
    coalesce(bool_or(lower(status) = 'estornado'), false),
    coalesce(bool_or(lower(status) in ('prorrogada','prorrogado')), false)
  into v_received, v_all_cancelled, v_has_estornado, v_has_prorrogada
  from installments
 where contract_id = v_contract_id;

  v_open := greatest(coalesce(v_contract_value, 0) - v_received, 0);

  if lower(coalesce(v_current, '')) in ('cancelado', 'cancelada') or v_all_cancelled then
    v_new_status := 'Cancelado';
    v_open := 0;
  elsif v_has_estornado then
    v_new_status := 'Estornado';
  elsif coalesce(v_is_pro_bono, false) and v_open <= 0.01 then
    v_new_status := 'Quitado';
    v_open := 0;
  elsif v_open <= 0.01 and v_received > 0 then
    v_new_status := 'Quitado';
  elsif v_received > 0 then
    v_new_status := 'Parcial';
  elsif v_has_prorrogada then
    v_new_status := 'Prorrogado';
  else
    v_new_status := 'Aberto';
  end if;

  update contracts
     set "amountReceived" = v_received,
         "amountReceivable" = v_open,
         status = v_new_status
   where id = v_contract_id
     and (status is distinct from v_new_status
          or "amountReceived" is distinct from v_received
          or "amountReceivable" is distinct from v_open);

  return null;
end;
$function$;

comment on function public.fn_recalculate_contract_totals() is
  'v5 20261127 — amountReceivable = contractValue - SUM(amountPaid).';

select current_database() as database,
       (select count(*) from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname = 'fn_recalculate_contract_totals'
           and pg_get_functiondef(p.oid) like '%v5 20261127%') as gatilho_v5,
       (select count(*) from public.backup_func_recalculate_receivable_20261127) as backup;

commit;

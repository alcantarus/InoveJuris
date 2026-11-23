-- Lote 14 — registro de pagamento de comissão com validação no servidor.
--
-- Hoje o saldo é conferido no navegador (commissionStatus). Isso deixa duas
-- brechas: dado desatualizado e manipulação do payload. A RPC abaixo valida
-- valor, vínculo contrato/indicador e saldo, usando o environment da claim
-- (a view vw_indicator_commission_status soma pagamentos de todos os ambientes
-- quando chamada sem RLS, então não pode ser usada aqui).
--
-- O lock `for update` no contrato serializa pagamentos simultâneos do mesmo
-- contrato, evitando que dois requests passem pela checagem de saldo juntos.

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
  v_env text := public._rls_environment();
  v_indicator bigint;
  v_total numeric;
  v_paid numeric;
  v_balance numeric;
  v_payment_id uuid;
begin
  if v_env is null or v_env not in ('production', 'test') then
    raise exception 'Sessão inválida ou sem ambiente definido';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Informe um valor válido';
  end if;

  select c.indicator_id,
         coalesce(c.base_comissao, 0) * coalesce(c."commissionPercent", 0) / 100.0
    into v_indicator, v_total
    from public.contracts c
   where c.id = p_contract_id
   for update;

  if not found then
    raise exception 'Contrato não encontrado';
  end if;

  if v_indicator is distinct from p_indicator_id then
    raise exception 'Este contrato não pertence ao indicador selecionado';
  end if;

  select coalesce(sum(cp.amount_paid), 0)
    into v_paid
    from public.commission_payments cp
   where cp.contract_id = p_contract_id
     and cp.environment = v_env;

  v_balance := v_total - v_paid;

  if p_amount > v_balance then
    raise exception 'O valor pago (R$ %) não pode ser maior que o saldo devedor (R$ %)',
      round(p_amount, 2), round(v_balance, 2);
  end if;

  insert into public.commission_payments
    (contract_id, indicator_id, amount_paid, description, environment)
  values
    (p_contract_id, p_indicator_id, p_amount,
     nullif(btrim(coalesce(p_description, '')), ''), v_env)
  returning id into v_payment_id;

  select coalesce(sum(cp.amount_paid), 0)
    into v_paid
    from public.commission_payments cp
   where cp.contract_id = p_contract_id
     and cp.environment = v_env;

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'total_paid', v_paid,
    'remaining_balance', v_total - v_paid
  );
end;
$$;

revoke all on function public.app_register_commission_payment(bigint, bigint, numeric, text) from public, anon, authenticated;
grant execute on function public.app_register_commission_payment(bigint, bigint, numeric, text) to authenticated;

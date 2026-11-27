-- FORWARD - tenant na RPC rpc_receber_parcela_com_metodo
-- 26/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Diagnostico 20:23Z: SECURITY INVOKER, hash b7d47249ea33e62627686a35c81a5ae8,
-- sem organization_id e sem leitura de claim.
-- Reutiliza o helper _tenant_claim_organization_id().
-- Salva o corpo original na mesma tabela de backup antes de substituir.
-- As funcoes delegadas (process_installment_payment e
-- rpc_recebimento_com_desdobramento) serao travadas no bloco seguinte.

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
   where nome = 'rpc_receber_parcela_com_metodo';

  if v_count = 0 then
    insert into public._tenant_rpc_backup_20261126 (nome, assinatura, hash_def, def)
    select p.proname,
           pg_get_function_identity_arguments(p.oid),
           md5(pg_get_functiondef(p.oid)),
           pg_get_functiondef(p.oid)
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = 'rpc_receber_parcela_com_metodo';
  elsif v_count <> 1 then
    raise exception 'Abortado: backup duplicado de rpc_receber_parcela_com_metodo (%)', v_count;
  end if;

  if not exists (
    select 1 from public._tenant_rpc_backup_20261126
     where nome = 'rpc_receber_parcela_com_metodo'
       and hash_def = 'b7d47249ea33e62627686a35c81a5ae8'
  ) then
    raise exception 'Abortado: definicao viva divergiu do diagnostico 20:23Z';
  end if;
end $$;

create or replace function public.rpc_receber_parcela_com_metodo(
  p_installment_id BIGINT,
  p_amount_paid DECIMAL(12,2),
  p_date DATE,
  p_description TEXT,
  p_account_id BIGINT,
  p_category_id BIGINT,
  p_payment_method TEXT,
  p_user_id BIGINT,
  p_interest DECIMAL(12,2) DEFAULT 0,
  p_fine DECIMAL(12,2) DEFAULT 0
) returns jsonb
language plpgsql
as $$
declare
  v_org         uuid := public._tenant_claim_organization_id();
  v_installment record;
  v_saldo       decimal(12,2);
  v_amount      decimal(12,2);
  v_is_partial  boolean;
  v_result      jsonb;
  v_tx_id       bigint;
begin
  -- v2 20261122 + tenant: grava historico de pagamento parcial em payments.

  if v_org is null then
    raise exception 'Organização da sessão não encontrada.' using errcode = '42501';
  end if;

  select * into v_installment
    from public.installments
   where id = p_installment_id
     and organization_id = v_org
   for update;

  if not found then
    raise exception 'Parcela % não encontrada nesta organização.', p_installment_id;
  end if;

  if p_amount_paid is null or p_amount_paid <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;

  if p_payment_method is null or btrim(p_payment_method) = '' then
    raise exception 'Informe a forma de pagamento.';
  end if;

  if p_payment_method not in (
    'Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito',
    'Transferência', 'Boleto', 'Cheque', 'Outro'
  ) then
    raise exception 'Forma de pagamento inválida: %', p_payment_method;
  end if;

  if p_account_id is null then
    raise exception 'Informe a conta de destino.';
  end if;

  if p_category_id is null then
    raise exception 'Informe a categoria.';
  end if;

  if p_user_id is not null and not exists (select 1 from public.users where id = p_user_id) then
    p_user_id := null;
  end if;

  v_saldo := v_installment.amount - coalesce(v_installment."amountPaid", 0);

  if p_amount_paid > v_saldo + 0.01 then
    raise exception 'O valor (%) é maior que o saldo da parcela (%).',
      p_amount_paid, v_saldo;
  end if;

  v_is_partial := p_amount_paid < v_saldo - 0.01;

  v_amount := case
    when v_is_partial
      then p_amount_paid + coalesce(p_interest, 0) + coalesce(p_fine, 0)
    else p_amount_paid
  end;

  if v_is_partial then
    v_result := public.rpc_recebimento_com_desdobramento(
      p_installment_id => p_installment_id,
      p_valor_principal_pago => p_amount_paid,
      p_valor_juros => p_interest,
      p_valor_multa => p_fine,
      p_account_id => p_account_id,
      p_category_id => p_category_id,
      p_date => p_date,
      p_description => p_description,
      p_user_id => p_user_id
    );
  else
    v_result := public.process_installment_payment(
      p_installment_id => p_installment_id,
      p_amount_paid => p_amount_paid,
      p_account_id => p_account_id,
      p_category_id => p_category_id,
      p_date => p_date,
      p_description => p_description,
      p_user_id => p_user_id,
      p_interest => p_interest,
      p_fine => p_fine
    );
  end if;

  select ft.id into v_tx_id
    from public.financial_transactions ft
   where ft.account_id = p_account_id
     and ft.category_id = p_category_id
     and ft.date = p_date
     and ft.amount = v_amount
     and ft.type = 'income'
     and ft.environment = v_installment.environment
     and ft.organization_id = v_org
   order by ft.id desc
   limit 1;

  if not exists (
    select 1
      from public.payments p
     where p.installment_id = p_installment_id
       and p.type = 'payment'
       and p.payment_date = p_date
       and p.amount = v_amount
       and p.organization_id = v_org
  ) then
    insert into public.payments (
      installment_id, amount, type, payment_date, account_id, category_id,
      description, environment, organization_id, created_by, payment_method
    ) values (
      p_installment_id, v_amount, 'payment', p_date, p_account_id, p_category_id,
      p_description, v_installment.environment, v_org, p_user_id, p_payment_method
    );
  end if;

  update public.payments p
     set payment_method = p_payment_method
   where p.id = (
     select p2.id
       from public.payments p2
      where p2.installment_id = p_installment_id
        and p2.type = 'payment'
        and p2.payment_date = p_date
        and p2.amount = v_amount
        and p2.organization_id = v_org
      order by p2.id desc
      limit 1
   );

  if v_tx_id is not null then
    update public.financial_transactions ft
       set payment_method = p_payment_method
     where ft.id = v_tx_id
       and ft.organization_id = v_org;
  end if;

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'payment_method', p_payment_method,
    'financial_transaction_id', v_tx_id
  );
end;
$$;

comment on function public.rpc_receber_parcela_com_metodo(
  BIGINT, NUMERIC, DATE, TEXT, BIGINT, BIGINT, TEXT, BIGINT, NUMERIC, NUMERIC
) is
  'Recebe uma parcela (integral ou parcial) usando a RPC canonica e grava a forma de pagamento e o historico em payments, restrito a organizacao da sessao.';

commit;

-- ============================================================================
-- ESTORNO COM COLAPSO DA ÁRVORE — FORWARD (PREPARADO, NÃO EXECUTADO)
-- 26/11/2026
--
-- Cria a RPC que estorna uma parcela mãe e marca a subparcela como
-- Reabsorvida, devolvendo o saldo à mãe. Só permite se:
--   - a mãe tiver valor pago;
--   - nenhum descendente ativo tiver valor pago;
--   - todas as folhas ativas estiverem Estornado (regra B).
--
-- Rode no SQL Editor de TEST primeiro. Rollback em
-- docs/ROLLBACK-ESTORNO-COLAPSO-ARVORE-20261126.sql.
-- ============================================================================

begin;

-- Gate: exige a árvore já aplicada e não sobrescreve nada existente.
do $guard$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'installments'
       and column_name in ('parent_installment_id', 'installment_path')
  ) then
    raise exception 'Abortado: a árvore de parcelas (FORWARD-ARVORE) não está aplicada neste projeto.';
  end if;

  if exists (
    select 1 from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname = 'process_installment_estorno_colapso'
  ) then
    raise exception 'Abortado: process_installment_estorno_colapso já existe.';
  end if;
end
$guard$;

create or replace function public.process_installment_estorno_colapso(
  p_installment_id bigint,
  p_reason text,
  p_account_id bigint,
  p_user_id bigint
) returns jsonb
language plpgsql
as $function$
declare
  v_installment record;
  v_contract_id bigint;
  v_contract_value numeric(12,2);
  v_amount numeric(12,2);
  v_old_obs text;
  v_payment record;
  v_new_received numeric(12,2);
  v_new_receivable numeric(12,2);
  v_all_paid boolean;
  v_some_paid boolean;
  v_has_estornado boolean;
  v_new_status text;
  v_desc_pago numeric(12,2);
  v_folhas_invalidas bigint;
  v_reabsorvidas bigint;
begin
  -- colapso v1 20261126 — uma transação: estorna a mãe e reabsorve os descendentes.

  if p_user_id is not null and not exists (select 1 from users where id = p_user_id) then
    p_user_id := null;
  end if;

  select * into v_installment
    from installments
   where id = p_installment_id
     for update;

  if not found then
    raise exception 'Parcela não encontrada';
  end if;

  v_amount := coalesce(v_installment."amountPaid", 0);
  if v_amount <= 0 then
    raise exception 'Esta parcela não possui valor pago para estornar';
  end if;

  -- Regra B: descendentes sem pago e todas as folhas ativas Estornado.
  with recursive subtree as (
    select id, parent_installment_id, status, "amountPaid"
      from installments
     where id = p_installment_id
    union all
    select c.id, c.parent_installment_id, c.status, c."amountPaid"
      from installments c
      join subtree s on c.parent_installment_id = s.id
     where c.status not in ('Reabsorvida', 'Cancelada', 'Cancelado')
  ),
  folhas as (
    select s.*
      from subtree s
     where s.id <> p_installment_id
       and not exists (
         select 1 from subtree x where x.parent_installment_id = s.id
       )
  )
  select
    (select coalesce(sum(coalesce("amountPaid", 0)), 0)
       from subtree where id <> p_installment_id),
    (select count(*)
       from folhas
      where lower(coalesce(status, '')) <> 'estornado'
         or coalesce("amountPaid", 0) <> 0)
    into v_desc_pago, v_folhas_invalidas;

  if v_desc_pago <> 0 then
    raise exception 'Existem pagamentos nas subparcelas. Estorne as folhas antes de colapsar.';
  end if;

  if v_folhas_invalidas > 0 then
    raise exception 'Todas as folhas da cadeia devem estar Estornado antes de estornar esta parcela.';
  end if;

  v_contract_id := v_installment.contract_id;
  select "contractValue", observations
    into v_contract_value, v_old_obs
    from contracts
   where id = v_contract_id;

  -- Estorno do pagamento da mãe (mesmo padrão da RPC v7).
  update installments
     set status = 'Estornado',
         "amountPaid" = 0,
         interest = 0,
         fine = 0,
         updated_by = p_user_id
   where id = p_installment_id;

  select * into v_payment
    from payments
   where installment_id = p_installment_id
     and type = 'payment'
   order by payment_date desc
   limit 1;

  if found then
    delete from financial_transactions
     where id in (
       select id
         from financial_transactions
        where amount = v_payment.amount
          and date = v_payment.payment_date
          and account_id = v_payment.account_id
          and type = 'income'
          and environment = v_installment.environment
        order by id desc
        limit 1
     );
  end if;

  insert into payments (
    installment_id, amount, type, payment_date, account_id,
    description, environment, created_by
  ) values (
    p_installment_id, v_amount, 'reversal', current_date, p_account_id,
    'Estorno com colapso: ' || p_reason, v_installment.environment, p_user_id
  );

  -- Colapso: a linha permanece como Reabsorvida (auditoria preservada).
  with recursive subtree as (
    select id, parent_installment_id
      from installments
     where id = p_installment_id
    union all
    select c.id, c.parent_installment_id
      from installments c
      join subtree s on c.parent_installment_id = s.id
     where c.status not in ('Reabsorvida', 'Cancelada', 'Cancelado')
  )
  update installments i
     set status = 'Reabsorvida',
         amount = 0,
         "amountPaid" = 0,
         interest = 0,
         fine = 0,
         parent_installment_id = null,
         installment_path = null,
         updated_by = p_user_id
    from subtree
   where i.id = subtree.id
     and i.id <> p_installment_id;

  get diagnostics v_reabsorvidas = row_count;

  -- Recálculo único, ignorando linhas reabsorvidas.
  select coalesce(sum("amountPaid"), 0)
    into v_new_received
    from installments
   where contract_id = v_contract_id
     and status <> 'Reabsorvida';

  v_new_receivable := greatest(0, coalesce(v_contract_value, 0) - v_new_received);

  select bool_and(status in ('Quitado', 'Cancelado')) and bool_or(status = 'Quitado'),
         bool_or(coalesce("amountPaid", 0) > 0),
         bool_or(status = 'Estornado')
    into v_all_paid, v_some_paid, v_has_estornado
    from installments
   where contract_id = v_contract_id
     and status <> 'Reabsorvida';

  if v_has_estornado then
    v_new_status := 'Estornado';
  elsif v_all_paid then
    v_new_status := 'Quitado';
  elsif v_some_paid then
    v_new_status := 'Parcial';
  else
    v_new_status := 'Aberto';
  end if;

  update contracts
     set "amountReceived" = v_new_received,
         "amountReceivable" = v_new_receivable,
         status = v_new_status,
         observations = coalesce(v_old_obs, '') || E'\n' || '[ESTORNO-COLAPSO]: ' || p_reason,
         updated_by = p_user_id
   where id = v_contract_id;

  return jsonb_build_object(
    'success', true,
    'parcela_estornada_id', p_installment_id,
    'subparcelas_reabsorvidas', v_reabsorvidas,
    'valor_estornado', v_amount,
    'new_received', v_new_received,
    'new_receivable', v_new_receivable,
    'new_status', v_new_status
  );
end;
$function$;

revoke all on function public.process_installment_estorno_colapso(bigint, text, bigint, bigint) from public;
grant execute on function public.process_installment_estorno_colapso(bigint, text, bigint, bigint) to authenticated, service_role;

comment on function public.process_installment_estorno_colapso(bigint, text, bigint, bigint) is
  'v1 20261126 — estorno de parcela com reabsorcao da subarvore; exige folhas Estornado e sem pagamento.';

-- Verificação estrutural (contagens, sem despejar registros).
select current_database() as database,
       (select count(*) from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname = 'process_installment_estorno_colapso') as rpc_criada,
       (select count(*) from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname = 'process_installment_estorno_colapso'
           and pg_get_functiondef(p.oid) like '%colapso v1 20261126%') as versao_ok,
       (select count(*) from public.installments
         where status = 'Reabsorvida') as reabsorvidas_antes_do_teste;

commit;

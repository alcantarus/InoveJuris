-- ============================================================================
-- ÁRVORE DE PARCELAS — etapa 1: banco (parcelas NOVAS)
-- 26/11/2026
--
-- Objetivo: permitir 1 -> 1.1 -> 1.1.1 em diante, sem renúmerar parcelas
-- antigas e sem alterar nenhum valor, data ou pagamento.
--
-- Executar no SQL Editor do projeto desejado (começar por TEST).
-- NÃO faz backfill: parcelas já desdobradas continuam com o número antigo.
-- Antes de substituir a RPC, guarda a definição atual numa tabela de backup
-- para que o ROLLBACK restaure exatamente o corpo anterior.
--
-- Termina num SELECT de verificação (linhas normais) seguido de COMMIT,
-- seguindo o padrão dos FORWARD do repositório. O rollback está em
-- docs/ROLLBACK-ARVORE-PARCELAS-20261126.sql.
-- ============================================================================

begin;

-- 1. Gate: não sobrescrever instalação que já tenha as colunas.
do $guard$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'installments'
       and column_name in ('parent_installment_id', 'installment_path')
  ) then
    raise exception 'Abortado: installments já possui parent_installment_id ou installment_path.';
  end if;

  -- Só substitui a versão canônica conhecida (v8 20261125).
  if not exists (
    select 1 from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = 'rpc_recebimento_com_desdobramento'
       and pg_get_functiondef(p.oid) like '%v8 20261125%'
       and pg_get_functiondef(p.oid) like '%saldo_atual%'
  ) then
    raise exception 'Abortado: rpc_recebimento_com_desdobramento não é a v8 esperada. Não substituir.';
  end if;
end
$guard$;

-- 2. Backup da definição exata da RPC (para rollback sem adivinhar o corpo).
create table if not exists public.backup_func_desdobramento_arvore_20261126 (
  id int primary key,
  definition text not null,
  created_at timestamptz not null default now()
);

insert into public.backup_func_desdobramento_arvore_20261126 (id, definition)
select 1,
       pg_get_functiondef(
         'public.rpc_recebimento_com_desdobramento(bigint, numeric, numeric, numeric, bigint, bigint, date, text, bigint)'::regprocedure
       )
on conflict (id) do nothing;

-- 3. Colunas novas (nulas em todos os registros existentes).
alter table public.installments
  add column parent_installment_id bigint
      references public.installments(id) on delete set null,
  add column installment_path text;

alter table public.installments
  add constraint installments_path_formato
  check (installment_path is null or installment_path ~ '^[0-9]+(\.[0-9]+)*$');

create index if not exists idx_installments_contract_path
  on public.installments (contract_id, installment_path)
  where installment_path is not null;

create index if not exists idx_installments_parent
  on public.installments (parent_installment_id)
  where parent_installment_id is not null;

-- 4. RPC v8 + vínculo hierárquico. A lógica financeira é idêntica à v8:
--    parcela original permanece Quitado com amountPaid acumulado, residual
--    recebe o saldo, um payment e uma transação. Muda só o vínculo/path.
create or replace function public.rpc_recebimento_com_desdobramento(
  p_installment_id bigint,
  p_valor_principal_pago numeric,
  p_valor_juros numeric,
  p_valor_multa numeric,
  p_account_id bigint,
  p_category_id bigint,
  p_date date,
  p_description text,
  p_user_id bigint
) returns jsonb
language plpgsql
as $function$
declare
  v_installment record;
  v_saldo_atual numeric(12,2);
  v_novo_saldo numeric(12,2);
  v_total_pago numeric(12,2);
  v_total_acumulado numeric(12,2);
  v_nova_parcela_id bigint;
  v_pagamento_id uuid;
  v_tx_id bigint;
  v_numero_novo integer;
  v_status text;
  v_path_pai text;
  v_indice_filha integer;
  v_path_novo text;
begin
  -- v8 20261125 + v9 20261126 (vinculo hierarquico / arvore)
  -- v9 acrescenta parent_installment_id e installment_path; nada financeiro muda.

  if p_user_id is not null and not exists (select 1 from users where id = p_user_id) then
    p_user_id := null;
  end if;

  select * into v_installment
    from installments
   where id = p_installment_id
     for update;

  if not found then
    raise exception 'Parcela % não encontrada.', p_installment_id;
  end if;

  v_status := lower(btrim(coalesce(v_installment.status, '')));

  if v_status in ('quitado', 'cancelado', 'cancelada') then
    raise exception 'A parcela % não possui saldo para desdobramento (status: %).',
      p_installment_id, v_installment.status;
  end if;

  if v_status in ('estornado', 'estornada')
     and coalesce(v_installment."amountPaid", 0) > 0 then
    raise exception 'A parcela % está estornada com valor pago residual (%). Regularize antes de receber.',
      p_installment_id, v_installment."amountPaid";
  end if;

  if p_valor_principal_pago is null or p_valor_principal_pago <= 0 then
    raise exception 'O valor principal pago deve ser maior que zero.';
  end if;

  v_saldo_atual := coalesce(v_installment.amount, 0)
                 - coalesce(v_installment."amountPaid", 0);

  if v_saldo_atual <= 0 then
    raise exception 'A parcela % não possui saldo em aberto.', p_installment_id;
  end if;

  if p_valor_principal_pago >= v_saldo_atual then
    raise exception 'O valor principal pago (%) deve ser estritamente menor que o saldo devedor da parcela (%). Para pagamentos integrais, utilize a baixa total.',
      p_valor_principal_pago, v_saldo_atual;
  end if;

  v_novo_saldo := v_saldo_atual - p_valor_principal_pago;
  v_total_pago := p_valor_principal_pago
                + coalesce(p_valor_juros, 0)
                + coalesce(p_valor_multa, 0);
  v_total_acumulado := coalesce(v_installment."amountPaid", 0) + v_total_pago;

  select coalesce(max("installmentNumber"), 0) + 1
    into v_numero_novo
    from installments
   where contract_id = v_installment.contract_id;

  -- Raiz sem path (dados antigos) usa o número inteiro; filha usa o path da mãe.
  v_path_pai := coalesce(nullif(btrim(v_installment.installment_path), ''),
                         v_installment."installmentNumber"::text);

  select count(*)::integer + 1
    into v_indice_filha
    from installments
   where parent_installment_id = p_installment_id;

  v_path_novo := v_path_pai || '.' || v_indice_filha::text;

  update installments
     set "amountPaid" = v_total_acumulado,
         interest = coalesce(interest, 0) + coalesce(p_valor_juros, 0),
         fine = coalesce(fine, 0) + coalesce(p_valor_multa, 0),
         status = 'Quitado',
         updated_by = p_user_id
   where id = p_installment_id;

  insert into installments (
      contract_id, "installmentNumber", "dueDate", amount, "amountPaid",
      status, interest, fine, environment, created_by, updated_by,
      parent_installment_id, installment_path
  ) values (
      v_installment.contract_id, v_numero_novo, v_installment."dueDate",
      v_novo_saldo, 0, 'Aberto', 0, 0, v_installment.environment, p_user_id, p_user_id,
      p_installment_id, v_path_novo
  ) returning id into v_nova_parcela_id;

  insert into financial_transactions (
      date, amount, type, account_id, category_id, description, environment, created_by
  ) values (
      p_date, v_total_pago, 'income', p_account_id, p_category_id,
      p_description, v_installment.environment, p_user_id
  ) returning id into v_tx_id;

  insert into payments (
      installment_id, amount, payment_date, account_id, category_id,
      description, environment, type, created_by, financial_transaction_id
  ) values (
      p_installment_id, v_total_pago, p_date, p_account_id, p_category_id,
      p_description, v_installment.environment, 'payment', p_user_id, v_tx_id
  ) returning id into v_pagamento_id;

  return jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Desdobramento realizado com sucesso.',
    'parcela_original_id', p_installment_id,
    'nova_parcela_id', v_nova_parcela_id,
    'pagamento_id', v_pagamento_id::text,
    'transacao_id', v_tx_id,
    'valor_remanescente', v_novo_saldo,
    'numero_novo', v_numero_novo,
    'path_novo', v_path_novo,
    'saldo_anterior', v_saldo_atual,
    'total_pago_acumulado', v_total_acumulado
  );
end;
$function$;

-- 5. Verificação estrutural (linhas normais, sem despejar registros).
select current_database() as database,
       'teste: rodar em cada projeto (test e production)' as observacao,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'installments'
           and column_name in ('parent_installment_id', 'installment_path')) as colunas_novas,
       (select count(*) from public.installments
         where parent_installment_id is not null or installment_path is not null) as linhas_vinculadas,
       (select count(*) from public.backup_func_desdobramento_arvore_20261126) as backup_rpc;

commit;

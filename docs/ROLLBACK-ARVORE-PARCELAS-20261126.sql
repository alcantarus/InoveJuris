-- ============================================================================
-- ÁRVORE DE PARCELAS — rollback
-- 26/11/2026
--
-- Ambiente declarado: executar no MESMO projeto onde o FORWARD foi rodado.
-- Restaura a RPC a partir da definição salva em
-- public.backup_func_desdobramento_arvore_20261126 e remove colunas,
-- constraint e índices. NÃO apaga parcelas, pagamentos nem transações
-- criados depois do FORWARD (isso exigiria autorização e medição prévia).
-- A tabela de backup é preservada como evidência.
-- ============================================================================

begin;

-- 1. Só restaura se houver backup e se a RPC atual for a v9 deste FORWARD.
do $$
declare
  v_def text;
  v_atual text;
begin
  select definition into v_def
    from public.backup_func_desdobramento_arvore_20261126
   where id = 1;

  if v_def is null or btrim(v_def) = '' then
    raise exception 'Abortado: não há definição salva da RPC no backup.';
  end if;

  select pg_get_functiondef(
    'public.rpc_recebimento_com_desdobramento(bigint, numeric, numeric, numeric, bigint, bigint, date, text, bigint)'::regprocedure
  ) into v_atual;

  if v_atual like '%v9 20261126%' then
    execute v_def;
    raise notice 'RPC restaurada para a versão v8 20261125.';
  elsif v_atual like '%v8 20261125%' then
    raise notice 'RPC já está na v8 20261125; restauração pulada.';
  else
    raise exception 'Abortado: RPC não é v9 nem v8. Não sobrescrever versão desconhecida.';
  end if;
end $$;

-- 2. Remove índices e constraint antes das colunas.
drop index if exists public.idx_installments_contract_path;
drop index if exists public.idx_installments_parent;

alter table public.installments
  drop constraint if exists installments_path_formato;

alter table public.installments
  drop column if exists parent_installment_id,
  drop column if exists installment_path;

-- 3. Verificação final (não despeja registros).
select current_database() as database,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'installments'
           and column_name in ('parent_installment_id', 'installment_path')) as colunas_restantes,
       (select count(*) from pg_indexes
         where schemaname = 'public' and tablename = 'installments'
           and indexname in ('idx_installments_contract_path', 'idx_installments_parent')) as indices_restantes,
       case when exists (
         select 1 from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname = 'rpc_recebimento_com_desdobramento'
            and pg_get_functiondef(p.oid) like '%v8 20261125%'
       ) then 'RPC v8 OK' else 'CONFERIR RPC' end as situacao_rpc,
       (select count(*) from public.backup_func_desdobramento_arvore_20261126) as backup_preservado;

commit;

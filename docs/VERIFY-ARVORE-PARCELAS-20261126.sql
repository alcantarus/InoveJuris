-- ============================================================================
-- ÁRVORE DE PARCELAS — verificação pós-FORWARD (somente leitura)
-- 26/11/2026
--
-- Roda no SQL Editor de cada projeto (test e production).
-- Linhas normais, sem JSON, sem temp table, sem bloco DO. Termina em ROLLBACK.
-- Confirma: colunas, constraint, índices, versão da RPC e nenhum backfill.
-- ============================================================================

begin;

select current_database() as database,
       'estrutura' as bloco,
       'information_schema.columns' as origem,
       (select count(*) from information_schema.columns
         where table_schema = 'public'
           and table_name = 'installments'
           and column_name in ('parent_installment_id', 'installment_path')) as encontrado,
       2 as esperado,
       case when (select count(*) from information_schema.columns
                   where table_schema = 'public'
                     and table_name = 'installments'
                     and column_name in ('parent_installment_id', 'installment_path')) = 2
            then 'OK' else 'FALHA' end as situacao

union all

select current_database(), 'constraint', 'pg_constraint',
       (select count(*) from pg_constraint
         where conname = 'installments_path_formato'
           and conrelid = 'public.installments'::regclass),
       1,
       case when exists (select 1 from pg_constraint
                          where conname = 'installments_path_formato'
                            and conrelid = 'public.installments'::regclass)
            then 'OK' else 'FALHA' end

union all

select current_database(), 'índices', 'pg_indexes',
       (select count(*) from pg_indexes
         where schemaname = 'public'
           and tablename = 'installments'
           and indexname in ('idx_installments_contract_path', 'idx_installments_parent')),
       2,
       case when (select count(*) from pg_indexes
                   where schemaname = 'public'
                     and tablename = 'installments'
                     and indexname in ('idx_installments_contract_path', 'idx_installments_parent')) = 2
            then 'OK' else 'FALHA' end

union all

select current_database(), 'RPC v9', 'pg_proc',
       (select count(*) from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname = 'rpc_recebimento_com_desdobramento'
           and pg_get_functiondef(p.oid) like '%v9 20261126%'
           and pg_get_functiondef(p.oid) like '%parent_installment_id%'
           and pg_get_functiondef(p.oid) like '%v8 20261125%'),
       1,
       case when exists (select 1 from pg_proc p
                          where p.pronamespace = 'public'::regnamespace
                            and p.proname = 'rpc_recebimento_com_desdobramento'
                            and pg_get_functiondef(p.oid) like '%v9 20261126%'
                            and pg_get_functiondef(p.oid) like '%parent_installment_id%'
                            and pg_get_functiondef(p.oid) like '%v8 20261125%')
            then 'OK' else 'FALHA' end

union all

select current_database(), 'backup da RPC', 'tabela de backup',
       (select count(*) from public.backup_func_desdobramento_arvore_20261126),
       1,
       case when (select count(*) from public.backup_func_desdobramento_arvore_20261126) = 1
            then 'OK' else 'FALHA' end

union all

select current_database(), 'sem backfill', 'installments',
       (select count(*) from public.installments
         where parent_installment_id is not null or installment_path is not null),
       0,
       case when (select count(*) from public.installments
                   where parent_installment_id is not null or installment_path is not null) = 0
            then 'OK — só parcelas novas' else 'CONFERIR' end

union all

select current_database(), 'resumo', 'resultado',
       (select count(*) from (
          select 1 as ok where exists (
            select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'installments'
               and column_name in ('parent_installment_id', 'installment_path')
             having count(*) = 2
          )
       ) x),
       1,
       case when
          (select count(*) from information_schema.columns
            where table_schema = 'public' and table_name = 'installments'
              and column_name in ('parent_installment_id', 'installment_path')) = 2
          and exists (select 1 from pg_proc p
                       where p.pronamespace = 'public'::regnamespace
                         and p.proname = 'rpc_recebimento_com_desdobramento'
                         and pg_get_functiondef(p.oid) like '%v9 20261126%')
          and (select count(*) from public.backup_func_desdobramento_arvore_20261126) = 1
         then 'PASS' else 'FALHA' end

order by 2;

rollback;

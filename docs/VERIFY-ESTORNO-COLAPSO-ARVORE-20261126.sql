-- ============================================================================
-- VERIFY — estorno com colapso (somente leitura)
-- 26/11/2026
--
-- Rode no SQL Editor de TEST após o FORWARD. Contagens, sem linhas completas.
-- ============================================================================

begin;

select current_database() as database,
       'RPC criada' as bloco,
       (select count(*) from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname = 'process_installment_estorno_colapso') as encontrado,
       1 as esperado,
       case when exists (select 1 from pg_proc p
                          where p.pronamespace = 'public'::regnamespace
                            and p.proname = 'process_installment_estorno_colapso')
            then 'OK' else 'FALHA' end as situacao

union all

select current_database(), 'versão v1',
       (select count(*) from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname = 'process_installment_estorno_colapso'
           and pg_get_functiondef(p.oid) like '%colapso v1 20261126%'),
       1,
       case when exists (select 1 from pg_proc p
                          where p.pronamespace = 'public'::regnamespace
                            and p.proname = 'process_installment_estorno_colapso'
                            and pg_get_functiondef(p.oid) like '%colapso v1 20261126%')
            then 'OK' else 'FALHA' end

union all

select current_database(), 'árvore presente',
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'installments'
           and column_name in ('parent_installment_id', 'installment_path')),
       2,
       case when (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = 'installments'
                     and column_name in ('parent_installment_id', 'installment_path')) = 2
            then 'OK' else 'FALHA' end

union all

select current_database(), 'sem colapso ainda',
       (select count(*) from public.installments where status = 'Reabsorvida'),
       0,
       case when (select count(*) from public.installments where status = 'Reabsorvida') = 0
            then 'OK — antes do teste funcional' else 'CONFERIR — teste já executado' end

order by 2;

rollback;

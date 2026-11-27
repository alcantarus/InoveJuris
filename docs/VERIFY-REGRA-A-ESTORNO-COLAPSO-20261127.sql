-- VERIFY — regra unificada do colapso (somente leitura)
-- 27/11/2026

begin;

select current_database() as database,
       (select count(*) from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname = 'process_installment_estorno_colapso'
           and pg_get_functiondef(p.oid) like '%colapso v2 20261127%') as regra_a_ativa,
       (select count(*) from public.backup_func_colapso_regra_a_20261127) as backup_v1,
       (select count(*) from public.installments where status = 'Reabsorvida') as reabsorvidas,
       case when exists (
         select 1 from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname = 'process_installment_estorno_colapso'
            and pg_get_functiondef(p.oid) like '%colapso v2 20261127%'
       ) then 'OK' else 'FALHA' end as situacao;

rollback;

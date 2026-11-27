-- ROLLBACK — volta a RPC v1 (regra B)
-- 27/11/2026 — PREPARADO, NÃO EXECUTADO

begin;

do $$
declare
  r record;
begin
  for r in
    select definition
      from public.backup_func_colapso_regra_a_20261127
     where id = 1
  loop
    execute r.definition;
  end loop;
end $$;

select current_database() as database,
       (select count(*) from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname = 'process_installment_estorno_colapso'
           and pg_get_functiondef(p.oid) like '%colapso v2 20261127%') as v2_restante;

commit;

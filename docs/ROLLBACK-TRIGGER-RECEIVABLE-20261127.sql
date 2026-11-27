-- ROLLBACK — gatilho fn_recalculate_contract_totals
-- 27/11/2026 — PREPARADO, NÃO EXECUTADO

begin;

do $$
declare
  r record;
begin
  for r in
    select definition
      from public.backup_func_recalculate_receivable_20261127
     where id = 1
  loop
    execute r.definition;
  end loop;
end $$;

select current_database() as database,
       (select count(*) from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname = 'fn_recalculate_contract_totals'
           and pg_get_functiondef(p.oid) like '%v5 20261127%') as v5_restante;

commit;

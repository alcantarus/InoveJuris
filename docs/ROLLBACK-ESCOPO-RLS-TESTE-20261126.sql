-- ROLLBACK — braço `test` compartilhado (T4b)
-- 26/11/2026
--
-- Remove somente as policies `P0 tenant teste compartilhado` criadas pelo
-- forward. Não toca policies P0 existentes, helpers, configuração nem dados.
--
-- REGRA: banco único; production/test são valores de environment.

begin;

do $$
declare
  r record;
  v_policy text := 'P0 tenant teste compartilhado';
  v_total  integer := 0;
begin
  select count(*) into v_total
    from pg_policies
   where schemaname = 'public'
     and policyname = v_policy;

  for r in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and exists (
             select 1 from pg_attribute a
              where a.attrelid = c.oid
                and a.attname = 'organization_id'
                and not a.attisdropped
           )
       and exists (
             select 1 from pg_attribute a
              where a.attrelid = c.oid
                and a.attname = 'environment'
                and not a.attisdropped
           )
     order by c.relname
  loop
    execute format('drop policy if exists %I on public.%I', v_policy, r.relname);
  end loop;

  raise notice 'Policies de teste compartilhado removidas: %.', v_total;
end $$;

commit;

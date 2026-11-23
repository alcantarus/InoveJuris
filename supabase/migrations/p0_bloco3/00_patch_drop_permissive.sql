-- P0 / Bloco 3 — correção da rotina de remoção de policies
--
-- Aplicar ANTES do lote 02 (a 00_fundacao.sql já foi executada em produção).
-- Motivo: a versão anterior removia qualquer policy SELECT/INSERT apenas por
-- `qual` ou `with_check` ser nulo. Isso apagaria policies restritivas, como
-- "Isolamento por Organização em users", preservada da F4b.
--
-- A nova versão remove SOMENTE policies com `USING (true)` / `WITH CHECK (true)`.

create or replace function public._p0_drop_permissive(p_tables text[])
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(p_tables)
      and (
           (qual is not null and lower(btrim(qual)) in ('true', 'true::boolean'))
        or (with_check is not null and lower(btrim(with_check)) in ('true', 'true::boolean'))
      )
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

revoke all on function public._p0_drop_permissive(text[]) from public, anon, authenticated;

-- Verificação (esperado: 0 linhas).
select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname = '_p0_drop_permissive'
  and pg_get_functiondef(p.oid) not like '%lower(btrim(qual))%';

-- P0 / Bloco 3 — correção da rotina de remoção de policies
--
-- Aplicar ANTES do lote 02 (a 00_fundacao.sql já foi executada em produção).
-- Não altera nenhuma policy; apenas recria duas funções auxiliares.
--
-- Motivo: a versão anterior só removia policies com USING (true) literal e
-- apagava policies SELECT/INSERT por `qual`/`with_check` nulo. Isso deixaria
-- passar policies permissivas disfarçadas, como
-- "Authenticated read access to users" (auth.role() = 'authenticated'), e
-- apagaria policies restritivas legítimas.
--
-- Nova regra: remover TODA policy PERMISSIVE das tabelas informadas, exceto
-- as explicitamente listadas em p_keep. Policies AS RESTRICTIVE nunca são
-- removidas.

create or replace function public._p0_drop_except(p_tables text[], p_keep text[])
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
      and permissive = 'PERMISSIVE'
      and not (coalesce(policyname, '') = any(p_keep))
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

create or replace function public._p0_drop_permissive(p_tables text[])
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public._p0_drop_except(p_tables, array[]::text[]);
end;
$$;

revoke all on function public._p0_drop_except(text[], text[]) from public, anon, authenticated;
revoke all on function public._p0_drop_permissive(text[]) from public, anon, authenticated;

-- Verificação (esperado: 1 linha, "_p0_drop_except").
select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname = '_p0_drop_except';

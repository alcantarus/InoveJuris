-- ROLLBACK - trigger de preenchimento de organization_id no INSERT
-- 26/11/2026
--
-- Desfaz somente o que docs/FORWARD-TRIGGER-ORG-20261126.sql fez:
--   - remove os triggers trg_fill_organization_id;
--   - remove a funcao fn_fill_organization_id_on_insert.
-- Nao altera dados das tabelas de negocio.
--
-- Ambiente declarado: production + test (banco unico).

begin;

do $$
declare
  r record;
  v_n bigint := 0;
begin
  if not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'fn_fill_organization_id_on_insert'
  ) then
    raise exception 'Nada a desfazer: funcao nao existe';
  end if;

  for r in
    select distinct c.relname as tabela
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and t.tgname = 'trg_fill_organization_id'
       and not t.tgisinternal
     order by c.relname
  loop
    execute format(
      'drop trigger trg_fill_organization_id on public.%I',
      r.tabela
    );
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    raise exception 'Nada a desfazer: nenhum trigger encontrado';
  end if;

  raise notice 'Triggers removidos de % tabelas', v_n;
end $$;

drop function if exists public.fn_fill_organization_id_on_insert();

commit;

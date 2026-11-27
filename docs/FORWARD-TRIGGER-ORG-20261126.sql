-- FORWARD - trigger de preenchimento de organization_id no INSERT
-- 26/11/2026
--
-- Correcao transitoria da causa raiz, ate o tenant completo ser implementado.
--
-- Regra:
--   - se o INSERT ja traz organization_id, nao altera;
--   - se vem NULL, preenche por NEW.environment:
--       production -> eaf29983-1998-40a4-bd07-03ea09b4adfa
--       test       -> cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd
--   - se houver app.organization_id na sessao, ele tem prioridade;
--   - environment fora do mapa sem app.organization_id aborta o INSERT.
--
-- So atua em INSERT. Nao atua em UPDATE, para nao atrapalhar rollbacks.
-- Aplica em todas as tabelas publicas que tenham organization_id + environment,
-- exceto tabelas historicas de backup.
--
-- Ambiente declarado: production + test (banco unico).

begin;

do $$
declare
  v_n bigint;
begin
  if not exists (
    select 1 from public.organizations
     where id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
       and name = 'Alcântara Advocacia'
       and slug = 'alcantara-advocacia'
       and is_demo is false
  ) then
    raise exception 'Abortando: organizacao de production nao confere';
  end if;

  if not exists (
    select 1 from public.organizations
     where id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
       and name = 'InoveJuris Demonstração'
       and slug = 'inovejuris-demo-homologacao'
       and is_demo is true
  ) then
    raise exception 'Abortando: organizacao de test nao confere';
  end if;

  select count(*) into v_n
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and t.tgname = 'trg_fill_organization_id'
     and not t.tgisinternal;

  if v_n > 0 then
    raise exception 'Abortando: trigger ja existe em % tabelas; rode o rollback primeiro', v_n;
  end if;
end $$;

create or replace function public.fn_fill_organization_id_on_insert()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_org uuid;
  v_setting text;
begin
  if NEW.organization_id is not null then
    return NEW;
  end if;

  v_setting := nullif(current_setting('app.organization_id', true), '');

  if v_setting is not null then
    v_org := v_setting::uuid;
  else
    v_org := case NEW.environment::text
      when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
      when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
      else null
    end;
  end if;

  if v_org is null then
    raise exception
      'organization_id nao preenchido: environment=% nao mapeado e app.organization_id ausente',
      NEW.environment::text;
  end if;

  NEW.organization_id := v_org;
  return NEW;
end;
$fn$;

do $$
declare
  r record;
  v_sql text;
  v_n bigint := 0;
begin
  for r in
    select c.relname as tabela
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and exists (
             select 1 from pg_attribute a
              where a.attrelid = c.oid
                and a.attname = 'organization_id'
                and a.attnum > 0
                and not a.attisdropped
       )
       and exists (
             select 1 from pg_attribute a
              where a.attrelid = c.oid
                and a.attname = 'environment'
                and a.attnum > 0
                and not a.attisdropped
       )
       and c.relname not like 'backup\_%'
       and c.relname <> 'birthday_templates_backup'
     order by c.relname
  loop
    v_sql := format(
      'create trigger trg_fill_organization_id before insert on public.%I '
      'for each row execute function public.fn_fill_organization_id_on_insert()',
      r.tabela
    );
    execute v_sql;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    raise exception 'Abortando: nenhuma tabela alvo encontrada';
  end if;

  raise notice 'Triggers criados em % tabelas', v_n;
end $$;

commit;

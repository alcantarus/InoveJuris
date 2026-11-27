-- FORWARD - preencher organization_id por environment
-- 26/11/2026
--
-- ATENCAO: NAO EXECUTAR sem o VERIFY-MAPEAMENTO-ORG-AMBIENTE-20261126.sql
-- favoravel e sem decisao explicita sobre os conflitos encontrados.
--
-- Regra estrita:
--   production -> eaf29983-1998-40a4-bd07-03ea09b4adfa
--                (Alcantara Advocacia, is_demo = false)
--   test       -> cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd
--                (InoveJuris Demonstracao, is_demo = true)
--
-- So atualiza linhas com organization_id IS NULL.
-- Qualquer linha ja preenchida com outro valor faz o script abortar.
-- Tabelas sem coluna environment nao sao tocadas.
-- Nenhuma linha de negocio e apagada.
--
-- Ambiente declarado: production + test (banco unico).

begin;

do $$
declare
  r record;
  v_sql text;
  v_n bigint;
  v_conflitos bigint := 0;
  v_tem_backup boolean;
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

  if to_regclass('public._backfill_org_ambiente_20261126') is not null then
    execute 'select exists (select 1 from public._backfill_org_ambiente_20261126)'
      into v_tem_backup;
    if v_tem_backup then
      raise exception 'Abortando: backup de um backfill anterior ainda existe; rode o rollback primeiro';
    end if;
  end if;

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
    v_sql := format($q$
      select count(*)
        from public.%I t
       where (t.environment = 'production'
              and t.organization_id is not null
              and t.organization_id <> 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid)
          or (t.environment = 'test'
              and t.organization_id is not null
              and t.organization_id <> 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)
    $q$, r.tabela);
    execute v_sql into v_n;
    v_conflitos := v_conflitos + v_n;
  end loop;

  if v_conflitos > 0 then
    raise exception 'Abortando: % linhas ja preenchidas contradizem o mapa; nada foi atualizado', v_conflitos;
  end if;
end $$;

drop table if exists public._backfill_org_ambiente_20261126;

create table public._backfill_org_ambiente_20261126 (
  id bigserial primary key,
  tabela text not null,
  pk jsonb not null,
  organization_id_anterior uuid,
  environment text,
  preenchido_em timestamptz not null default now(),
  unique (tabela, pk)
);

do $$
declare
  r record;
  v_pk text;
  v_sql text;
  v_n bigint;
  v_total bigint := 0;
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
    select string_agg(format('%L, %I', a.attname, a.attname), ', ' order by k.ord)
      into v_pk
      from pg_index i
      join unnest(i.indkey) with ordinality as k(attnum, ord) on true
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
     where i.indrelid = ('public.' || quote_ident(r.tabela))::regclass
       and i.indisprimary;

    if v_pk is null then
      raise exception 'Abortando: tabela % nao tem chave primaria', r.tabela;
    end if;

    v_sql := format($q$
      insert into public._backfill_org_ambiente_20261126
             (tabela, pk, organization_id_anterior, environment)
      select %L,
             jsonb_build_object(%s),
             t.organization_id,
             t.environment
        from public.%I t
       where t.organization_id is null
         and t.environment in ('production', 'test')
    $q$, r.tabela, v_pk, r.tabela);
    execute v_sql;

    v_sql := format($q$
      update public.%I t
         set organization_id = case t.environment
               when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
               when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
             end
       where t.organization_id is null
         and t.environment in ('production', 'test')
    $q$, r.tabela);
    execute v_sql;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  raise notice 'Backfill concluido: % linhas preenchidas', v_total;
end $$;

commit;

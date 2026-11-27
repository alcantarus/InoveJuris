-- FORWARD - backfill do LOTE 3 (69 linhas)
-- 26/11/2026
--
-- Autorizado apos a previa docs/VERIFY-BACKFILL-LOTE-03-20261126.sql.
--
-- Tabelas deste lote (contagens conferidas na previa):
--   clients               (37 production + 0 test)
--   commission_payments   (13 production + 2 test)
--   financial_categories  (17 production + 0 test)
--
-- So preenche organization_id onde esta NULL, por environment:
--   production -> eaf29983-1998-40a4-bd07-03ea09b4adfa
--   test       -> cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd
--
-- Guardas: se qualquer contagem divergir da previa, aborta sem alterar nada.
-- Cria backup public._backfill_lote03_20261126 para rollback.
-- Nenhuma linha e apagada.
--
-- Ambiente declarado: production + test (banco unico).

begin;

do $$
declare
  r record;
  v_n bigint;
  v_total bigint := 0;
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

  if to_regclass('public._backfill_lote03_20261126') is not null then
    execute 'select exists (select 1 from public._backfill_lote03_20261126)'
      into v_tem_backup;
    if v_tem_backup then
      raise exception 'Abortando: backup do Lote 3 ja existe; rode o rollback primeiro';
    end if;
  end if;

  for r in
    select * from (values
      ('clients',             37::bigint, 0::bigint),
      ('commission_payments', 13::bigint, 2::bigint),
      ('financial_categories',17::bigint, 0::bigint)
    ) as x(tabela, esperado_production, esperado_test)
  loop
    execute format(
      'select count(*) from public.%I where organization_id is null and environment = ''production''',
      r.tabela
    ) into v_n;
    if v_n <> r.esperado_production then
      raise exception 'Abortando: %/production esperado %, encontrado %', r.tabela, r.esperado_production, v_n;
    end if;

    execute format(
      'select count(*) from public.%I where organization_id is null and environment = ''test''',
      r.tabela
    ) into v_n;
    if v_n <> r.esperado_test then
      raise exception 'Abortando: %/test esperado %, encontrado %', r.tabela, r.esperado_test, v_n;
    end if;

    v_total := v_total + r.esperado_production + r.esperado_test;
  end loop;

  if v_total <> 69 then
    raise exception 'Abortando: total esperado do Lote 3 e 69, calculado %', v_total;
  end if;
end $$;

drop table if exists public._backfill_lote03_20261126;

create table public._backfill_lote03_20261126 (
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
  v_backup bigint;
begin
  for r in
    select unnest(array[
      'clients',
      'commission_payments',
      'financial_categories'
    ]) as tabela
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

    execute format($q$
      insert into public._backfill_lote03_20261126
             (tabela, pk, organization_id_anterior, environment)
      select %L,
             jsonb_build_object(%s),
             t.organization_id,
             t.environment::text
        from public.%I t
       where t.organization_id is null
         and t.environment in ('production', 'test')
    $q$, r.tabela, v_pk, r.tabela);

    execute format($q$
      update public.%I t
         set organization_id = case t.environment::text
               when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
               when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
             end
       where t.organization_id is null
         and t.environment in ('production', 'test')
    $q$, r.tabela);

    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  select count(*) into v_backup
    from public._backfill_lote03_20261126;

  if v_backup <> 69 then
    raise exception 'Abortando: backup capturou % linhas, esperado 69', v_backup;
  end if;

  if v_total <> 69 then
    raise exception 'Abortando: atualizou % linhas, esperado 69', v_total;
  end if;

  raise notice 'Backfill Lote 3 concluido: % linhas preenchidas', v_total;
end $$;

commit;

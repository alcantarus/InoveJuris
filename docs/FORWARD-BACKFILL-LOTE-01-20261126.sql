-- FORWARD - backfill do LOTE 1 (9 linhas)
-- 26/11/2026
--
-- Autorizado apos a previa docs/VERIFY-BACKFILL-LOTE-01-20261126.sql.
--
-- Tabelas deste lote:
--   bank_accounts              (2 production + 1 test)
--   birthday_templates         (1 production)
--   client_onboarding_tokens   (1 production + 2 test)
--   client_tags                (2 production)
--
-- So preenche organization_id onde esta NULL, por environment:
--   production -> eaf29983-1998-40a4-bd07-03ea09b4adfa
--   test       -> cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd
--
-- Guardas: se a contagem nao for exatamente a da previa, aborta sem alterar nada.
-- Cria backup public._backfill_lote01_20261126 para rollback.
-- Nenhuma linha e apagada.
--
-- Ambiente declarado: production + test (banco unico).

begin;

do $$
declare
  v_n bigint;
  v_total bigint;
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

  if to_regclass('public._backfill_lote01_20261126') is not null then
    execute 'select exists (select 1 from public._backfill_lote01_20261126)'
      into v_tem_backup;
    if v_tem_backup then
      raise exception 'Abortando: backup do Lote 1 ja existe; rode o rollback primeiro';
    end if;
  end if;

  select count(*) into v_n from public.bank_accounts
   where organization_id is null and environment = 'production';
  if v_n <> 2 then raise exception 'Abortando: bank_accounts/production esperado 2, encontrado %', v_n; end if;

  select count(*) into v_n from public.bank_accounts
   where organization_id is null and environment = 'test';
  if v_n <> 1 then raise exception 'Abortando: bank_accounts/test esperado 1, encontrado %', v_n; end if;

  select count(*) into v_n from public.birthday_templates
   where organization_id is null and environment = 'production';
  if v_n <> 1 then raise exception 'Abortando: birthday_templates/production esperado 1, encontrado %', v_n; end if;

  select count(*) into v_n from public.client_onboarding_tokens
   where organization_id is null and environment = 'production';
  if v_n <> 1 then raise exception 'Abortando: client_onboarding_tokens/production esperado 1, encontrado %', v_n; end if;

  select count(*) into v_n from public.client_onboarding_tokens
   where organization_id is null and environment = 'test';
  if v_n <> 2 then raise exception 'Abortando: client_onboarding_tokens/test esperado 2, encontrado %', v_n; end if;

  select count(*) into v_n from public.client_tags
   where organization_id is null and environment = 'production';
  if v_n <> 2 then raise exception 'Abortando: client_tags/production esperado 2, encontrado %', v_n; end if;

  select
      (select count(*) from public.bank_accounts where organization_id is null and environment in ('production','test'))
    + (select count(*) from public.birthday_templates where organization_id is null and environment in ('production','test'))
    + (select count(*) from public.client_onboarding_tokens where organization_id is null and environment in ('production','test'))
    + (select count(*) from public.client_tags where organization_id is null and environment in ('production','test'))
    into v_total;

  if v_total <> 9 then
    raise exception 'Abortando: total do Lote 1 e %, esperado 9', v_total;
  end if;
end $$;

drop table if exists public._backfill_lote01_20261126;

create table public._backfill_lote01_20261126 (
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
      'bank_accounts',
      'birthday_templates',
      'client_onboarding_tokens',
      'client_tags'
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
      insert into public._backfill_lote01_20261126
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
    from public._backfill_lote01_20261126;

  if v_backup <> 9 then
    raise exception 'Abortando: backup capturou % linhas, esperado 9', v_backup;
  end if;

  if v_total <> 9 then
    raise exception 'Abortando: atualizou % linhas, esperado 9', v_total;
  end if;

  raise notice 'Backfill Lote 1 concluido: % linhas preenchidas', v_total;
end $$;

commit;

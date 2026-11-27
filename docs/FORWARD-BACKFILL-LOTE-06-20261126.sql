-- FORWARD - backfill do LOTE 6 (1070 linhas) - ULTIMO LOTE
-- 26/11/2026
--
-- Tabela deste lote (contagem medida ao vivo):
--   financial_transactions (1017 production + 53 test) = 1070
--
-- So preenche organization_id onde esta NULL, por environment:
--   production -> eaf29983-1998-40a4-bd07-03ea09b4adfa
--   test       -> cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd
--
-- Guardas: se qualquer contagem divergir da medicao, aborta sem alterar nada.
-- Cria backup public._backfill_lote06_20261126 para rollback.
-- Nenhuma linha e apagada.
--
-- Triggers: toda trigger publica habilitada com evento UPDATE em
-- financial_transactions e desativada somente durante o UPDATE, e reativada
-- antes do commit (ou em caso de erro). As demais (INSERT/DELETE) nao sao
-- alteradas. Motivo: evitar efeito colateral em audit_logs ou em outras tabelas.
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

  if to_regclass('public._backfill_lote06_20261126') is not null then
    execute 'select exists (select 1 from public._backfill_lote06_20261126)'
      into v_tem_backup;
    if v_tem_backup then
      raise exception 'Abortando: backup do Lote 6 ja existe; rode o rollback primeiro';
    end if;
  end if;

  execute 'select count(*) from public.financial_transactions where organization_id is null and environment = ''production'''
    into v_n;
  if v_n <> 1017 then
    raise exception 'Abortando: financial_transactions/production esperado 1017, encontrado %', v_n;
  end if;

  execute 'select count(*) from public.financial_transactions where organization_id is null and environment = ''test'''
    into v_n;
  if v_n <> 53 then
    raise exception 'Abortando: financial_transactions/test esperado 53, encontrado %', v_n;
  end if;

  select 1017 + 53 into v_total;
  if v_total <> 1070 then
    raise exception 'Abortando: total esperado do Lote 6 e 1070, calculado %', v_total;
  end if;
end $$;

drop table if exists public._backfill_lote06_20261126;

create table public._backfill_lote06_20261126 (
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
  v_nome text;
  v_trigs text[] := array[]::text[];
  v_n bigint;
  v_total bigint := 0;
  v_backup bigint;
begin
  -- Desativa somente triggers publicas habilitadas com evento UPDATE.
  for r in
    select t.tgname::text as nome
      from pg_trigger t
     where t.tgrelid = 'public.financial_transactions'::regclass
       and not t.tgisinternal
       and (t.tgtype & 8) <> 0
       and t.tgenabled = 'O'
     order by t.tgname
  loop
    execute format('alter table public.financial_transactions disable trigger %I', r.nome);
    v_trigs := v_trigs || r.nome;
  end loop;

  begin
    execute format($q$
      insert into public._backfill_lote06_20261126
             (tabela, pk, organization_id_anterior, environment)
      select 'financial_transactions',
             jsonb_build_object('id', t.id),
             t.organization_id,
             t.environment::text
        from public.financial_transactions t
       where t.organization_id is null
         and t.environment in ('production', 'test')
    $q$);

    execute $q$
      update public.financial_transactions t
         set organization_id = case t.environment::text
               when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
               when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
             end
       where t.organization_id is null
         and t.environment in ('production', 'test')
    $q$;

    get diagnostics v_n = row_count;
    v_total := v_n;
  exception when others then
    foreach v_nome in array v_trigs loop
      execute format('alter table public.financial_transactions enable trigger %I', v_nome);
    end loop;
    raise;
  end;

  foreach v_nome in array v_trigs loop
    execute format('alter table public.financial_transactions enable trigger %I', v_nome);
  end loop;

  select count(*) into v_backup
    from public._backfill_lote06_20261126;

  if v_backup <> 1070 then
    raise exception 'Abortando: backup capturou % linhas, esperado 1070', v_backup;
  end if;

  if v_total <> 1070 then
    raise exception 'Abortando: atualizou % linhas, esperado 1070', v_total;
  end if;

  raise notice 'Backfill Lote 6 concluido: % linhas preenchidas; % triggers reativadas', v_total, coalesce(array_length(v_trigs, 1), 0);
end $$;

commit;

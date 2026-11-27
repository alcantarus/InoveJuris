-- VERIFY - conferencia apos o backfill do LOTE 4 (168 linhas)
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Arquivo distinto da previa:
--   docs/VERIFY-BACKFILL-LOTE-04-20261126.sql        = previa (antes do UPDATE)
--   docs/VERIFY-BACKFILL-LOTE-04-POS-20261126.sql    = conferencia (depois do UPDATE)
--
-- Esperado:
--   nulos_production = 0
--   nulos_test = 0
--   backup.linhas = 168
--   organization_id_errados = 0
--   lote04_concluido = true

begin;

do $$
declare
  r record;
  v_pk text;
  v_n bigint;
  v_errados bigint := 0;
begin
  if to_regclass('public._backfill_lote04_20261126') is not null then
    perform set_config(
      'verify.lote04_backup',
      (select count(*)::text from public._backfill_lote04_20261126),
      true
    );

    for r in
      select distinct tabela
        from public._backfill_lote04_20261126
       order by tabela
    loop
      select string_agg(format('%L, %I', a.attname, a.attname), ', ' order by k.ord)
        into v_pk
        from pg_index i
        join unnest(i.indkey) with ordinality as k(attnum, ord) on true
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
       where i.indrelid = ('public.' || quote_ident(r.tabela))::regclass
         and i.indisprimary;

      if v_pk is null then
        raise exception 'Verify abortado: tabela % nao tem chave primaria', r.tabela;
      end if;

      execute format($q$
        select count(*)
          from public._backfill_lote04_20261126 b
          join public.%I t on to_jsonb(t) @> b.pk
         where b.tabela = %L
           and t.organization_id is distinct from (
                 case b.environment
                   when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
                   when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
                 end
               )
      $q$, r.tabela, r.tabela) into v_n;

      v_errados := v_errados + v_n;
    end loop;

    perform set_config('verify.lote04_org_errados', v_errados::text, true);
  else
    perform set_config('verify.lote04_backup', '0', true);
    perform set_config('verify.lote04_org_errados', '0', true);
  end if;
end $$;

with dados as (
  select 'contracts'::text as tabela,
         count(*) filter (where organization_id is null and environment = 'production') as nulos_production,
         count(*) filter (where organization_id is null and environment = 'test') as nulos_test
    from public.contracts
  union all
  select 'installments',
         count(*) filter (where organization_id is null and environment = 'production'),
         count(*) filter (where organization_id is null and environment = 'test')
    from public.installments
),
resumo as (
  select
    coalesce(sum(d.nulos_production), 0) as nulos_production,
    coalesce(sum(d.nulos_test), 0) as nulos_test,
    coalesce(nullif(current_setting('verify.lote04_org_errados', true), ''), '0')::bigint as org_errados,
    coalesce(nullif(current_setting('verify.lote04_backup', true), ''), '0')::bigint as backup_linhas,
    (select coalesce(jsonb_agg(jsonb_build_object(
               'tabela', x.tabela,
               'nulos_production', x.nulos_production,
               'nulos_test', x.nulos_test
             ) order by x.tabela), '[]'::jsonb) from dados x) as por_tabela
  from dados d
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'por_tabela', por_tabela,
  'nulos_production', nulos_production,
  'nulos_test', nulos_test,
  'organization_id_errados', org_errados,
  'backup', jsonb_build_object(
    'tabela_existe', to_regclass('public._backfill_lote04_20261126') is not null,
    'linhas', backup_linhas
  ),
  'lote04_concluido', (
        nulos_production = 0
    and nulos_test = 0
    and org_errados = 0
    and backup_linhas = 168
  )
)) as resumo
from resumo;

rollback;

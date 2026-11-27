-- VERIFY - conferencia global consolidada do backfill de tenant
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Varredura dinamica de toda tabela publica que tenha organization_id e
-- environment. Nao mostra linhas, apenas agregados.
--
-- Esperado:
--   tabelas_verificadas > 0
--   nulos_production_test = 0
--   organization_id_errados = 0
--   backfill_total_aplicado = 1899 (9+71+69+168+512+1070)
--   backups com as contagens esperadas
--   tabelas_com_trigger_org = tabelas_com_organization_id
--   triggers_publicas_desabilitadas = []
--   organizacoes do mapa intactas

begin;

do $$
declare
  r record;
  v_n bigint;
  v_nulos bigint := 0;
  v_errados bigint := 0;
  v_tabelas integer := 0;
  v_backups jsonb := '[]'::jsonb;
begin
  for r in
    select c.relname::text as tabela
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public'
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
    v_tabelas := v_tabelas + 1;

    execute format(
      'select count(*) from public.%I where organization_id is null and environment in (''production'', ''test'')',
      r.tabela
    ) into v_n;
    v_nulos := v_nulos + v_n;

    execute format($q$
      select count(*) from public.%I
       where environment = 'production'
         and organization_id is distinct from 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
    $q$, r.tabela) into v_n;
    v_errados := v_errados + v_n;

    execute format($q$
      select count(*) from public.%I
       where environment = 'test'
         and organization_id is distinct from 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
    $q$, r.tabela) into v_n;
    v_errados := v_errados + v_n;
  end loop;

  perform set_config('verify.global_tabelas', v_tabelas::text, true);
  perform set_config('verify.global_nulos', v_nulos::text, true);
  perform set_config('verify.global_errados', v_errados::text, true);

  for r in
    select * from (values
      ('_backfill_lote01_20261126',    9::bigint),
      ('_backfill_lote02_20261126',   71::bigint),
      ('_backfill_lote03_20261126',   69::bigint),
      ('_backfill_lote04_20261126',  168::bigint),
      ('_backfill_lote05_20261126',  512::bigint),
      ('_backfill_lote06_20261126', 1070::bigint),
      ('_correcao_ambiente_24_20261126', 24::bigint)
    ) as x(tabela, esperado)
  loop
    if to_regclass('public.' || quote_ident(r.tabela)) is null then
      v_n := 0;
    else
      execute format('select count(*) from public.%I', r.tabela) into v_n;
    end if;

    v_backups := v_backups || jsonb_build_object(
      'tabela', r.tabela,
      'linhas', v_n,
      'esperado', r.esperado,
      'conferido', v_n = r.esperado
    );
  end loop;

  perform set_config('verify.global_backups', v_backups::text, true);
end $$;

with numeros as (
  select
    coalesce(nullif(current_setting('verify.global_tabelas', true), ''), '0')::integer as tabelas_verificadas,
    coalesce(nullif(current_setting('verify.global_nulos', true), ''), '0')::bigint as nulos_production_test,
    coalesce(nullif(current_setting('verify.global_errados', true), ''), '0')::bigint as organization_id_errados,
    coalesce(nullif(current_setting('verify.global_backups', true), ''), '[]')::jsonb as backups
),
backups as (
  select
    (select coalesce(jsonb_agg(b.doc), '[]'::jsonb)
       from jsonb_array_elements(n.backups) as b(doc)) as detalhe,
    (select coalesce(sum((b.doc ->> 'linhas')::bigint) filter (where b.doc ->> 'tabela' not like '_correcao_%'), 0)
       from jsonb_array_elements(n.backups) as b(doc)) as backfill_total_aplicado,
    (select count(*) = 0
       from jsonb_array_elements(n.backups) as b(doc)
      where (b.doc ->> 'conferido')::boolean is not true) as backups_conferem
  from numeros n
),
organizacoes as (
  select
    exists (
      select 1 from public.organizations
       where id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
         and name = 'Alcântara Advocacia'
         and slug = 'alcantara-advocacia'
         and is_demo is false
    ) as producao_ok,
    exists (
      select 1 from public.organizations
       where id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
         and name = 'InoveJuris Demonstração'
         and slug = 'inovejuris-demo-homologacao'
         and is_demo is true
    ) as teste_ok
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'tabelas_verificadas', n.tabelas_verificadas,
  'nulos_production_test', n.nulos_production_test,
  'organization_id_errados', n.organization_id_errados,
  'backfill_total_aplicado', b.backfill_total_aplicado,
  'backups_conferem', b.backups_conferem,
  'backups', b.detalhe,
  'organizacoes', jsonb_build_object(
    'production', o.producao_ok,
    'test', o.teste_ok
  ),
  'tabelas_com_organization_id', n.tabelas_verificadas,
  'tabelas_com_trigger_org', (
    select count(distinct c.oid)
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace ns on ns.oid = c.relnamespace
      join pg_proc p on p.oid = t.tgfoid
     where ns.nspname = 'public'
       and t.tgname = 'trg_fill_organization_id'
       and p.proname = 'fn_fill_organization_id_on_insert'
       and t.tgenabled = 'O'
       and not t.tgisinternal
  ),
  'triggers_publicas_desabilitadas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'tabela', c.relname,
             'trigger', t.tgname,
             'estado', t.tgenabled::text
           ) order by c.relname, t.tgname), '[]'::jsonb)
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where not t.tgisinternal
       and c.relnamespace = 'public'::regnamespace
       and t.tgenabled <> 'O'
  ),
  'backfill_global_concluido', (
       n.nulos_production_test = 0
   and n.organization_id_errados = 0
   and b.backfill_total_aplicado = 1899
   and b.backups_conferem
   and o.producao_ok
   and o.teste_ok
  )
)) as resumo
from numeros n
cross join backups b
cross join organizacoes o;

rollback;

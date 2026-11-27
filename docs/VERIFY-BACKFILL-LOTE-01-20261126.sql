-- VERIFY - conferencia apos o backfill do LOTE 1
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Esperado:
--   nulos_production = 0
--   nulos_test = 0
--   backup.linhas = 9
--   lote01_concluido = true

begin;

do $$
begin
  if to_regclass('public._backfill_lote01_20261126') is not null then
    perform set_config(
      'verify.lote01_backup',
      (select count(*)::text from public._backfill_lote01_20261126),
      true
    );
  else
    perform set_config('verify.lote01_backup', '0', true);
  end if;
end $$;

with dados as (
  select 'bank_accounts'::text as tabela,
         count(*) filter (where organization_id is null and environment = 'production') as nulos_production,
         count(*) filter (where organization_id is null and environment = 'test') as nulos_test
    from public.bank_accounts
  union all
  select 'birthday_templates',
         count(*) filter (where organization_id is null and environment = 'production'),
         count(*) filter (where organization_id is null and environment = 'test')
    from public.birthday_templates
  union all
  select 'client_onboarding_tokens',
         count(*) filter (where organization_id is null and environment = 'production'),
         count(*) filter (where organization_id is null and environment = 'test')
    from public.client_onboarding_tokens
  union all
  select 'client_tags',
         count(*) filter (where organization_id is null and environment = 'production'),
         count(*) filter (where organization_id is null and environment = 'test')
    from public.client_tags
),
resumo as (
  select
    coalesce(sum(d.nulos_production), 0) as nulos_production,
    coalesce(sum(d.nulos_test), 0) as nulos_test,
    coalesce(nullif(current_setting('verify.lote01_backup', true), ''), '0')::bigint as backup_linhas,
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
  'backup', jsonb_build_object(
    'tabela_existe', to_regclass('public._backfill_lote01_20261126') is not null,
    'linhas', backup_linhas
  ),
  'lote01_concluido', (
        nulos_production = 0
    and nulos_test = 0
    and backup_linhas = 9
  )
)) as resumo
from resumo;

rollback;

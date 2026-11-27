-- VERIFY - conferencia apos o backfill do LOTE 6 (1070 linhas) - ULTIMO LOTE
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Arquivo distinto da previa:
--   docs/VERIFY-BACKFILL-LOTE-06-20261126.sql       = previa agregada (antes)
--   docs/VERIFY-BACKFILL-LOTE-06-POS-20261126.sql   = conferencia (depois)
--
-- Esperado:
--   nulos_production = 0
--   nulos_test = 0
--   backup.linhas = 1070
--   organization_id_errados = 0
--   lote06_concluido = true

begin;

do $$
declare
  v_n bigint;
begin
  if to_regclass('public._backfill_lote06_20261126') is not null then
    perform set_config(
      'verify.lote06_backup',
      (select count(*)::text from public._backfill_lote06_20261126),
      true
    );

    select count(*)
      into v_n
      from public._backfill_lote06_20261126 b
      join public.financial_transactions t on t.id = (b.pk ->> 'id')::bigint
     where t.organization_id is distinct from (
             case b.environment
               when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
               when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
             end
           );

    perform set_config('verify.lote06_org_errados', v_n::text, true);
  else
    perform set_config('verify.lote06_backup', '0', true);
    perform set_config('verify.lote06_org_errados', '0', true);
  end if;
end $$;

with resumo as (
  select
    (select count(*) from public.financial_transactions
      where organization_id is null and environment = 'production') as nulos_production,
    (select count(*) from public.financial_transactions
      where organization_id is null and environment = 'test') as nulos_test,
    coalesce(nullif(current_setting('verify.lote06_org_errados', true), ''), '0')::bigint as org_errados,
    coalesce(nullif(current_setting('verify.lote06_backup', true), ''), '0')::bigint as backup_linhas
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'tabela', 'financial_transactions',
  'nulos_production', nulos_production,
  'nulos_test', nulos_test,
  'organization_id_errados', org_errados,
  'backup', jsonb_build_object(
    'tabela_existe', to_regclass('public._backfill_lote06_20261126') is not null,
    'linhas', backup_linhas
  ),
  'lote06_concluido', (
        nulos_production = 0
    and nulos_test = 0
    and org_errados = 0
    and backup_linhas = 1070
  )
)) as resumo
from resumo;

rollback;

-- VERIFY — fundação do Escopo de Ambiente (T3/T4a)
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test.
-- Executar logo após docs/FORWARD-ESCOPO-FUNDACAO-20261126.sql.

begin;

select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',

  'helpers', jsonb_build_object(
    '_rls_organization_id_existe', to_regprocedure('public._rls_organization_id()') is not null,
    '_rls_test_shared_existe',     to_regprocedure('public._rls_test_shared()') is not null,
    'org_execute_anon',            has_function_privilege('anon', 'public._rls_organization_id()', 'EXECUTE'),
    'org_execute_authenticated',   has_function_privilege('authenticated', 'public._rls_organization_id()', 'EXECUTE'),
    'test_execute_anon',           has_function_privilege('anon', 'public._rls_test_shared()', 'EXECUTE'),
    'test_execute_authenticated',  has_function_privilege('authenticated', 'public._rls_test_shared()', 'EXECUTE')
  ),

  'tenant_test_scope', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object('environment', s.environment, 'value', s.value)
               order by s.environment
             ),
             '[]'::jsonb
           )
      from public.system_settings s
     where s.key = 'tenant_test_scope'
       and s.environment in ('production', 'test')
  ),

  'organizations', jsonb_build_object(
    'linhas', (select count(*) from public.organizations),
    'colunas', (
      select coalesce(jsonb_agg(column_name order by ordinal_position), '[]'::jsonb)
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'organizations'
    )
  ),

  'policies', jsonb_build_object(
    'total', (select count(*) from pg_policies where schemaname = 'public'),
    'com_true_literal', (
      select count(*)
        from pg_policies
       where schemaname = 'public'
         and (
           lower(btrim(coalesce(qual, ''))) = 'true'
           or lower(btrim(coalesce(with_check, ''))) = 'true'
         )
    )
  ),

  'esperado', jsonb_build_object(
    'helpers_existem', true,
    'tenant_test_scope_production', '{"mode":"shared"}',
    'organizations_linhas', 2,
    'policies_total', 63,
    'policies_com_true_literal', 0,
    'linhas_de_negocio_alteradas', 0
  )
)) as resumo;

rollback;

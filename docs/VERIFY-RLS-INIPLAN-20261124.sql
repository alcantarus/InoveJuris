-- VERIFY — RLS com InitPlan (célula única: verify_rls_initplan)
-- 24/11/2026. Somente leitura. Versão corrigida após o verify de 18:47:25 UTC:
-- o catálogo normaliza o texto e os padrões antigos geraram falsos positivos.
--
-- Texto normalizado pelo PostgreSQL 17:
--   (select public._rls_can_access(null))
--     -> ( SELECT _rls_can_access(NULL::text) AS _rls_can_access)
--   _rls_can_access(environment)
--     -> _rls_can_access((environment)::text)
--
-- Contadores esperados após o FIX:
--   policies_total = 63, policies_com_rls_can_access = 55,
--   policies_com_initplan = 55, policies_forma_direta_restante = 0,
--   policies_com_argumento_coluna = 0.

with politicas as (
  select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
   where schemaname = 'public'
), sinais as (
  select p.*,
    (
      coalesce(qual, '') ~* '\(\s*SELECT\s+_rls_can_access\(NULL::text\)'
      or coalesce(with_check, '') ~* '\(\s*SELECT\s+_rls_can_access\(NULL::text\)'
    ) as tem_initplan,
    (
      coalesce(qual, '') ~* '_rls_can_access\(\s*\(?\s*environment'
      or coalesce(with_check, '') ~* '_rls_can_access\(\s*\(?\s*environment'
    ) as tem_coluna,
    (
      coalesce(qual, '') ilike '%_rls_can_access%'
      or coalesce(with_check, '') ilike '%_rls_can_access%'
    ) as usa_rls_can_access
  from politicas p
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'policies_total', (select count(*) from politicas),
  'policies_com_rls_can_access', (select count(*) from sinais where usa_rls_can_access),
  'policies_com_initplan', (select count(*) from sinais where tem_initplan),
  'policies_forma_direta_restante', (select count(*) from sinais where usa_rls_can_access and not tem_initplan),
  'policies_com_argumento_coluna', (select count(*) from sinais where tem_coluna),
  'restantes', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', tablename,
             'nome', policyname,
             'using', qual,
             'with_check', with_check
           ) order by tablename, policyname)
      from sinais
     where usa_rls_can_access and not tem_initplan
  ), '[]'::jsonb),
  'portal_clients_qual', (
    select qual
      from pg_policies
     where schemaname = 'public'
       and tablename = 'clients'
       and policyname = 'P0 portal indicador'
  ),
  'policies', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', tablename,
             'nome', policyname,
             'cmd', cmd,
             'using', qual,
             'with_check', with_check
           ) order by tablename, policyname)
      from sinais
     where usa_rls_can_access
        or (tablename = 'clients' and policyname = 'P0 portal indicador')
  ), '[]'::jsonb),
  'contagens', jsonb_build_object(
    'contracts', (select count(*) from public.contracts),
    'installments', (select count(*) from public.installments),
    'payments', (select count(*) from public.payments),
    'commission_payments', (select count(*) from public.commission_payments)
  ),
  'search_all_teste', public.search_all('ana', 'production')
)) as verify_rls_initplan;

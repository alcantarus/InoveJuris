-- VERIFY — RLS com InitPlan (célula única: verify_rls_initplan)
-- 24/11/2026. Somente leitura. Comparar com o estado pré-forward:
--   policies antigas com _rls_can_access(environment) devem desaparecer;
--   contagens 125/181/177/15 permanecem; busca global continua funcionando.

select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'policies_total', (
    select count(*) from pg_policies where schemaname = 'public'
  ),
  'policies_com_argumento_coluna', (
    select count(*)
      from pg_policies
     where schemaname = 'public'
       and (
         (qual ilike '%_rls_can_access(%' and qual not ilike '%_rls_can_access(null)%')
         or (with_check ilike '%_rls_can_access(%' and with_check not ilike '%_rls_can_access(null)%')
       )
  ),
  'policies_com_initplan', (
    select count(*)
      from pg_policies
     where schemaname = 'public'
       and (
         qual ilike '%(select public._rls_can_access(null))%'
         or with_check ilike '%(select public._rls_can_access(null))%'
       )
  ),
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
      from pg_policies
     where schemaname = 'public'
       and (
         qual ilike '%_rls_can_access%'
         or with_check ilike '%_rls_can_access%'
         or (tablename = 'clients' and policyname = 'P0 portal indicador')
       )
  ), '[]'::jsonb),
  'contagens', jsonb_build_object(
    'contracts', (select count(*) from public.contracts),
    'installments', (select count(*) from public.installments),
    'payments', (select count(*) from public.payments),
    'commission_payments', (select count(*) from public.commission_payments)
  ),
  'search_all_teste', public.search_all('ana', 'production')
)) as verify_rls_initplan;

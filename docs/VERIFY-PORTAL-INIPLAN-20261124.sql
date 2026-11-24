-- VERIFY — InitPlan nas policies do portal (célula única: verify_portal_initplan)
-- 24/11/2026. Somente leitura.
--
-- Esperado após o FORWARD:
--   policies_com_portal_direto = 0
--   policies_com_portal_initplan > 0
--   restantes = []
--   contagens 125/181/177/15 e busca global com 5 clientes + 5 contratos.
-- Texto normalizado do InitPlan:
--   ( SELECT _rls_portal_indicator_id() AS _rls_portal_indicator_id)

with politicas as (
  select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
   where schemaname = 'public'
), sinais as (
  select p.*,
    (
      coalesce(qual, '') ilike '%_rls_portal_indicator_id%'
      or coalesce(with_check, '') ilike '%_rls_portal_indicator_id%'
    ) as usa_portal,
    (
      coalesce(qual, '') ilike '%SELECT _rls_portal_indicator_id%'
      or coalesce(with_check, '') ilike '%SELECT _rls_portal_indicator_id%'
    ) as tem_initplan
  from politicas p
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'policies_total', (select count(*) from politicas),
  'policies_com_portal', (select count(*) from sinais where usa_portal),
  'policies_com_portal_initplan', (select count(*) from sinais where tem_initplan),
  'policies_com_portal_direto', (select count(*) from sinais where usa_portal and not tem_initplan),
  'restantes', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', tablename,
             'nome', policyname,
             'using', qual,
             'with_check', with_check
           ) order by tablename, policyname)
      from sinais
     where usa_portal and not tem_initplan
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', tablename,
             'nome', policyname,
             'cmd', cmd,
             'using', qual,
             'with_check', with_check
           ) order by tablename, policyname)
      from sinais
     where usa_portal
  ), '[]'::jsonb),
  'portal_clients_qual', (
    select qual
      from pg_policies
     where schemaname = 'public'
       and tablename = 'clients'
       and policyname = 'P0 portal indicador'
  ),
  'portal_indicators_qual', (
    select qual
      from pg_policies
     where schemaname = 'public'
       and tablename = 'indicators'
       and policyname = 'P0 portal indicador leitura'
  ),
  'contagens', jsonb_build_object(
    'contracts', (select count(*) from public.contracts),
    'installments', (select count(*) from public.installments),
    'payments', (select count(*) from public.payments),
    'commission_payments', (select count(*) from public.commission_payments)
  ),
  'search_all_teste', public.search_all('ana', 'production')
)) as verify_portal_initplan;

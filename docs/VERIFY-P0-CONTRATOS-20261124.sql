-- VERIFICAÇÃO P0 — somente leitura. Célula única: verify_p0_contratos.
-- Rodar logo após FORWARD-P0 e comparar com a medição prévia.

SELECT jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),

  'policies_portal', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'tabela', tablename,
      'nome', policyname,
      'using', qual,
      'ok', qual LIKE '%_rls_can_access(environment)%'
    ) ORDER BY tablename, policyname)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('contracts', 'commission_payments')
      AND qual LIKE '%_rls_portal_indicator_id()%'
  ), '[]'::jsonb),

  'views_dashboard', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'nome', c.relname,
      'exclui_estornado', pg_get_viewdef(c.oid, true) LIKE '%Estornado%',
      'security_invoker', coalesce(c.reloptions::text LIKE '%security_invoker=on%', false)
    ) ORDER BY c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND c.relname IN (
        'vw_dashboard_receivables_forecast',
        'vw_dashboard_receivables_metrics',
        'vw_dashboard_top_defaulters'
      )
  ), '[]'::jsonb),

  'search_all_sem_colunas_inexistentes', NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'search_all'
      AND pg_get_function_identity_arguments(p.oid) = 'p_term text, p_environment text'
      AND (
        pg_get_functiondef(p.oid) LIKE '%contractNumber%'
        OR pg_get_functiondef(p.oid) LIKE '%clientId%'
      )
  ),

  'search_all_teste', public.search_all('ana', 'production'),

  'installments_estornado', (
    SELECT count(*) FROM public.installments
    WHERE status IN ('Estornado', 'Estornada')
  ),

  'views_valores', jsonb_build_object(
    'receivables_metrics', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.environment)
      FROM public.vw_dashboard_receivables_metrics t
    ), '[]'::jsonb),
    'receivables_forecast_linhas', (
      SELECT count(*) FROM public.vw_dashboard_receivables_forecast
    ),
    'receivables_forecast_soma', (
      SELECT coalesce(sum(expected_amount), 0) FROM public.vw_dashboard_receivables_forecast
    ),
    'top_defaulters_linhas', (
      SELECT count(*) FROM public.vw_dashboard_top_defaulters
    ),
    'top_defaulters_soma', (
      SELECT coalesce(sum(total_overdue_amount), 0) FROM public.vw_dashboard_top_defaulters
    )
  ),

  'contagens', jsonb_build_object(
    'contracts', (SELECT count(*) FROM public.contracts),
    'installments', (SELECT count(*) FROM public.installments),
    'payments', (SELECT count(*) FROM public.payments),
    'commission_payments', (SELECT count(*) FROM public.commission_payments)
  )
)) AS verify_p0_contratos;

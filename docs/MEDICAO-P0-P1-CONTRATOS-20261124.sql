-- SOMENTE LEITURA — não executar DDL nem UPDATE/DELETE.
-- Célula única: medicao_previa_contratos.
-- Objetivo: capturar o estado real antes de aplicar P0/P1.
-- Autorização para executar no SQL Editor: explícita do usuário (24/11/2026).

SELECT jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'servidor', current_setting('server_version'),

  'policies_portal', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'tabela', tablename,
      'nome', policyname,
      'cmd', cmd,
      'roles', roles,
      'using', qual,
      'with_check', with_check
    ) ORDER BY tablename, policyname)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('contracts', 'commission_payments')
      AND (
        qual LIKE '%_rls_portal_indicator_id()%'
        OR with_check LIKE '%_rls_portal_indicator_id()%'
      )
  ), '[]'::jsonb),

  'views_dashboard', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'nome', c.relname,
      'opcoes', c.reloptions,
      'definicao', pg_get_viewdef(c.oid, true)
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

  'search_all_definicao', (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'search_all'
      AND pg_get_function_identity_arguments(p.oid) = 'text, text'
  ),

  'colunas_contratos', COALESCE((
    SELECT jsonb_agg(column_name ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contracts'
  ), '[]'::jsonb),

  'indices', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'tabela', tablename,
      'indice', indexname,
      'definicao', indexdef
    ) ORDER BY tablename, indexname)
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('payments', 'installments', 'commission_payments')
  ), '[]'::jsonb),

  'duplicatas_parcelas', (
    SELECT count(*)
    FROM (
      SELECT contract_id, "installmentNumber"
      FROM public.installments
      GROUP BY contract_id, "installmentNumber"
      HAVING count(*) > 1
    ) d
  ),

  'contagens', jsonb_build_object(
    'contracts', (SELECT count(*) FROM public.contracts),
    'installments', (SELECT count(*) FROM public.installments),
    'payments', (SELECT count(*) FROM public.payments),
    'commission_payments', (SELECT count(*) FROM public.commission_payments)
  )
)) AS medicao_previa_contratos;

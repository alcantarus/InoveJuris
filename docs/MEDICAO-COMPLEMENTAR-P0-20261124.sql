-- SOMENTE LEITURA — célula única: medicao_complementar_p0.
-- Complemento da medição de 18:15:48 UTC. Dois objetivos:
--   1) descobrir por que search_all(text,text) não foi encontrado;
--   2) capturar o baseline numérico das views antes do P0.2.
-- Nenhuma escrita.

SELECT jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),

  'funcoes_search_all', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'nome', p.proname,
      'args_identidade', pg_get_function_identity_arguments(p.oid),
      'args_chamada', pg_get_function_arguments(p.oid),
      'retorno', pg_get_function_result(p.oid),
      'definicao', pg_get_functiondef(p.oid)
    ) ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'search_all'
  ), '[]'::jsonb),

  'installments_estornado', (
    SELECT count(*) FROM public.installments
    WHERE status IN ('Estornado', 'Estornada')
  ),

  'baseline_views', jsonb_build_object(
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
  )
)) AS medicao_complementar_p0;

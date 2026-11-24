-- ROLLBACK P0 — NÃO APLICAR SEM AUTORIZAÇÃO EXPLÍCITA.
-- Reverte policies, views e search_all ao estado anterior ao FORWARD-P0.
-- Nenhum UPDATE/DELETE de dados de negócio.

-- ---------------------------------------------------------------------------
-- P0.1 — remover o filtro de ambiente das policies do portal
-- ---------------------------------------------------------------------------
DO $pol$
DECLARE
  r record;
  v_prefix constant text := '_rls_can_access(environment) AND (';
  v_using text;
  v_check text;
  v_roles text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('contracts', 'commission_payments')
      AND qual LIKE '_rls_can_access(environment) AND (%'
  LOOP
    v_using := substr(r.qual, length(v_prefix) + 1, length(r.qual) - length(v_prefix) - 1);
    v_check := CASE
      WHEN r.with_check LIKE '_rls_can_access(environment) AND (%'
        THEN substr(r.with_check, length(v_prefix) + 1, length(r.with_check) - length(v_prefix) - 1)
      ELSE r.with_check
    END;
    v_roles := coalesce(nullif(array_to_string(r.roles, ', '), ''), 'public');

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR %s TO %s USING (%s)%s',
      r.policyname, r.schemaname, r.tablename, r.cmd, v_roles, v_using,
      CASE WHEN v_check IS NOT NULL THEN format(' WITH CHECK (%s)', v_check) ELSE '' END
    );
  END LOOP;
END
$pol$;

-- ---------------------------------------------------------------------------
-- P0.2 — voltar a excluir apenas Quitado/Cancelada nas views
-- ---------------------------------------------------------------------------
DO $vw$
DECLARE
  r record;
  v_def text;
  v_new text;
BEGIN
  FOR r IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND c.relname IN (
        'vw_dashboard_receivables_forecast',
        'vw_dashboard_receivables_metrics',
        'vw_dashboard_top_defaulters'
      )
  LOOP
    v_def := pg_get_viewdef(r.oid, true);
    v_new := v_def;

    v_new := regexp_replace(
      v_new,
      $re$ARRAY\[\s*'Quitado'\s*,\s*'Cancelada'\s*,\s*'Estornado'\s*,\s*'Estornada'\s*\]$re$,
      $re$ARRAY['Quitado','Cancelada']$re$,
      'g'
    );
    v_new := regexp_replace(
      v_new,
      $re$\(\s*'Quitado'\s*,\s*'Cancelada'\s*,\s*'Estornado'\s*,\s*'Estornada'\s*\)$re$,
      $re$('Quitado','Cancelada')$re$,
      'g'
    );

    IF v_new IS DISTINCT FROM v_def THEN
      v_new := regexp_replace(v_new, ';\s*$', '');
      EXECUTE format(
        'CREATE OR REPLACE VIEW public.%I WITH (security_invoker = on) AS %s',
        r.relname, v_new
      );
    END IF;
  END LOOP;
END
$vw$;

-- ---------------------------------------------------------------------------
-- P0.3 — restaurar search_all canônico (com contractNumber)
-- Observação: esta é a definição anterior, que continha o predicado quebrado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_all(p_term text, p_environment text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_term text;
  v_result jsonb;
BEGIN
  IF p_term IS NULL OR btrim(p_term) = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  v_term := '%' || public.immutable_unaccent(lower(p_term)) || '%';

  WITH clients_search AS (
    SELECT jsonb_build_object(
      'type', 'client',
      'id', c.id,
      'title', c.name,
      'link', '/clientes/' || c.id
    ) AS item
    FROM public.clients c
    WHERE (p_environment IS NULL OR c.environment = p_environment)
      AND (
        public.immutable_unaccent(lower(coalesce(c.name, ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(c.document, ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(c.email, ''))) ILIKE v_term
      )
    LIMIT 5
  ),
  processes_search AS (
    SELECT jsonb_build_object(
      'type', 'process',
      'id', p.id,
      'title', 'Processo: ' || coalesce(p."processNumber", p.number::text, ''),
      'link', '/processos'
    ) AS item
    FROM public.processes p
    WHERE (p_environment IS NULL OR p.environment = p_environment)
      AND (
        public.immutable_unaccent(lower(coalesce(p."processNumber", ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(p.number::text, ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(p.client, ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(p.court, ''))) ILIKE v_term
      )
    LIMIT 5
  ),
  contracts_search AS (
    SELECT jsonb_build_object(
      'type', 'contract',
      'id', c.id,
      'title', 'Contrato: ' || coalesce(cl.name, c."processNumber", 'Sem cliente'),
      'link', '/contratos'
    ) AS item
    FROM public.contracts c
    LEFT JOIN public.clients cl ON cl.id = c."clientId"
    WHERE (p_environment IS NULL OR c.environment = p_environment)
      AND (
        public.immutable_unaccent(lower(coalesce(cl.name, ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(c."processNumber", ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(c."contractNumber", ''))) ILIKE v_term
      )
    LIMIT 5
  )
  SELECT coalesce(jsonb_agg(item), '[]'::jsonb) INTO v_result
  FROM (
    SELECT item FROM clients_search
    UNION ALL
    SELECT item FROM processes_search
    UNION ALL
    SELECT item FROM contracts_search
  ) s;

  RETURN coalesce(v_result, '[]'::jsonb);
END
$fn$;

GRANT EXECUTE ON FUNCTION public.search_all(text, text) TO anon, authenticated, service_role;

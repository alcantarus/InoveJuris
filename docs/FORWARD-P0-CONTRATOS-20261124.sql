-- P0 — isolamento e busca global (Contratos / Contas a Receber / Fluxo de Caixa)
-- NÃO APLICAR SEM AUTORIZAÇÃO EXPLÍCITA E MEDIÇÃO PRÉVIA.
-- Pré-requisito: executar docs/MEDICAO-P0-P1-CONTRATOS-20261124.sql e guardar o JSON.
-- Nenhum UPDATE/DELETE. Apenas DDL de policies, views e function.

-- ---------------------------------------------------------------------------
-- P0.1 — policies do portal: exigir _rls_can_access(environment)
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
      AND qual LIKE '%_rls_portal_indicator_id()%'
      AND qual NOT LIKE '%_rls_can_access(environment)%'
  LOOP
    v_using := v_prefix || r.qual || ')';
    v_check := CASE
      WHEN r.with_check IS NOT NULL THEN v_prefix || r.with_check || ')'
      ELSE NULL
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
-- P0.2 — views de dashboard: excluir Estornado/Estornada
-- Mantém definição atual; altera somente a lista de status.
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

    -- Forma ARRAY[...] (ex.: status <> ALL (ARRAY['Quitado','Cancelada']))
    v_new := regexp_replace(
      v_new,
      $re$ARRAY\[\s*'Quitado'(::\w+)?\s*,\s*'Cancelada'(::\w+)?\s*\]$re$,
      $re$ARRAY['Quitado','Cancelada','Estornado','Estornada']$re$,
      'g'
    );

    -- Forma NOT IN (...) (ex.: status NOT IN ('Quitado','Cancelada'))
    v_new := regexp_replace(
      v_new,
      $re$\(\s*'Quitado'(::\w+)?\s*,\s*'Cancelada'(::\w+)?\s*\)$re$,
      $re$('Quitado','Cancelada','Estornado','Estornada')$re$,
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
-- P0.3 — search_all(text,text): remover o predicado de contractNumber
-- contracts.contractNumber NÃO existe em produção.
-- Acesso dinâmico via to_jsonb(c) evita depender de colunas não confirmadas.
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
      'title', 'Contrato: ' || coalesce(cl.name, to_jsonb(c) ->> 'processNumber', 'Sem cliente'),
      'link', '/contratos'
    ) AS item
    FROM public.contracts c
    LEFT JOIN public.clients cl
      ON cl.id = coalesce(to_jsonb(c) ->> 'clientId', to_jsonb(c) ->> 'client_id')::bigint
    WHERE (p_environment IS NULL OR c.environment = p_environment)
      AND (
        public.immutable_unaccent(lower(coalesce(cl.name, ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(to_jsonb(c) ->> 'processNumber', ''))) ILIKE v_term
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

-- Correção P0.3 — somente a função search_all.
-- Motivo: FORWARD-P0 aplicou, mas o VERIFY encontrou processes.processNumber inexistente.
-- Não reaplica policies nem views. Nenhum UPDATE/DELETE.

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
      'title', 'Processo: ' || coalesce(to_jsonb(p) ->> 'processNumber', to_jsonb(p) ->> 'number', ''),
      'link', '/processos'
    ) AS item
    FROM public.processes p
    WHERE (p_environment IS NULL OR to_jsonb(p) ->> 'environment' = p_environment)
      AND (
        public.immutable_unaccent(lower(coalesce(to_jsonb(p) ->> 'processNumber', ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(to_jsonb(p) ->> 'number', ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(to_jsonb(p) ->> 'client', ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(to_jsonb(p) ->> 'court', ''))) ILIKE v_term
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
    LEFT JOIN public.clients cl ON cl.id = c.client_id
    WHERE (p_environment IS NULL OR c.environment = p_environment)
      AND (
        public.immutable_unaccent(lower(coalesce(cl.name, ''))) ILIKE v_term
        OR public.immutable_unaccent(lower(coalesce(c."processNumber", ''))) ILIKE v_term
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

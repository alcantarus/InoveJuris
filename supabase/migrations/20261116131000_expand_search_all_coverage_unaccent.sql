-- Expande busca global (accent-insensitive) com mais campos
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.search_all(p_term text, p_environment text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_term text;
  v_result jsonb;
BEGIN
  IF p_term IS NULL OR btrim(p_term) = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  v_term := '%' || unaccent(lower(p_term)) || '%';

  WITH clients_search AS (
    SELECT jsonb_build_object(
      'type', 'client',
      'id', c.id,
      'title', c.name,
      'link', '/clientes/' || c.id
    ) AS item
    FROM clients c
    WHERE (p_environment IS NULL OR c.environment = p_environment)
      AND (
        unaccent(lower(coalesce(c.name, ''))) ILIKE v_term
        OR unaccent(lower(coalesce(c.document, ''))) ILIKE v_term
        OR unaccent(lower(coalesce(c.email, ''))) ILIKE v_term
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
    FROM processes p
    WHERE (p_environment IS NULL OR p.environment = p_environment)
      AND (
        unaccent(lower(coalesce(p."processNumber", ''))) ILIKE v_term
        OR unaccent(lower(coalesce(p.number::text, ''))) ILIKE v_term
        OR unaccent(lower(coalesce(p.client, ''))) ILIKE v_term
        OR unaccent(lower(coalesce(p.court, ''))) ILIKE v_term
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
    FROM contracts c
    LEFT JOIN clients cl ON cl.id = c."clientId"
    WHERE (p_environment IS NULL OR c.environment = p_environment)
      AND (
        unaccent(lower(coalesce(cl.name, ''))) ILIKE v_term
        OR unaccent(lower(coalesce(c."processNumber", ''))) ILIKE v_term
        OR unaccent(lower(coalesce(c."contractNumber", ''))) ILIKE v_term
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_all(text, text) TO anon, authenticated, service_role;

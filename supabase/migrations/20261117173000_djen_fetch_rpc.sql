-- Proxy de leitura do DJEN executado no egress do Postgres do Supabase (sa-east-1).
-- Motivo: o CloudFront do DJEN bloqueia tanto a Vercel quanto a Edge Function
-- quando esta última é alocada em us-east-1. O banco roda em sa-east-1, região
-- aceita pelo DJEN. Host e caminho são fixos: não é um proxy arbitrário.

DROP FUNCTION IF EXISTS public.djen_fetch(text, integer);

CREATE OR REPLACE FUNCTION public.djen_fetch(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_response http_response;
  v_headers jsonb := '{}'::jsonb;
BEGIN
  IF p_query IS NULL OR length(BTRIM(p_query)) = 0 OR length(p_query) > 2000 THEN
    RAISE EXCEPTION 'Consulta DJEN inválida.';
  END IF;

  -- Versão de 1 argumento: o 2º argumento de http_get são query params e
  -- quebraria a URL já montada. Os headers padrão são suficientes no egress do DB.
  SELECT * INTO v_response
  FROM public.http_get(
    'https://comunicaapi.pje.jus.br/api/v1/comunicacao?' || p_query
  );

  BEGIN
    SELECT COALESCE(jsonb_object_agg(lower(h.field), h.value), '{}'::jsonb)
      INTO v_headers
      FROM unnest(v_response.headers) AS h;
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::jsonb;
  END;

  RETURN jsonb_build_object(
    'status', v_response.status,
    'content', COALESCE(v_response.content, ''),
    'headers', v_headers
  );
END $$;

REVOKE ALL ON FUNCTION public.djen_fetch(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.djen_fetch(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.djen_fetch(text) IS
  'Consulta somente leitura à API pública do DJEN, executada no egress sa-east-1 do Postgres.';

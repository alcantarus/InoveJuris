-- Busca accent-insensitive: wrapper IMMUTABLE (necessário para índices funcionais), RPCs atualizadas e índices
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Wrapper IMMUTABLE para uso em expressões indexáveis e consultas
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1);
$$;

-- Busca global expandida (usa immutable_unaccent para permitir uso de índices)
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

  v_term := '%' || public.immutable_unaccent(lower(p_term)) || '%';

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
    FROM processes p
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
    FROM contracts c
    LEFT JOIN clients cl ON cl.id = c."clientId"
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_all(text, text) TO anon, authenticated, service_role;

-- Listagem de clientes com resumo (usa immutable_unaccent)
CREATE OR REPLACE FUNCTION get_clients_with_process_summary(
    p_from INT,
    p_to INT,
    p_search_term TEXT DEFAULT NULL,
    p_environment TEXT DEFAULT 'production'
)
RETURNS TABLE (
    client_data JSONB,
    active_processes_count BIGINT,
    delayed_processes_count BIGINT,
    health_score INT,
    total_receivable DECIMAL(12,2),
    total_received DECIMAL(12,2),
    total_overdue DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        to_jsonb(c.*) AS client_data,
        COALESCE(s.active_processes_count, 0) AS active_processes_count,
        COALESCE(s.delayed_processes_count, 0) AS delayed_processes_count,
        (
            CASE
                WHEN c.last_contact_at IS NULL THEN 0
                WHEN c.last_contact_at > NOW() - INTERVAL '30 days' THEN 40
                WHEN c.last_contact_at > NOW() - INTERVAL '60 days' THEN 20
                ELSE 0
            END +
            CASE
                WHEN COALESCE(f.total_overdue, 0) > 0 THEN 0
                WHEN COALESCE(f.total_receivable, 0) > 0 THEN 20
                ELSE 30
            END +
            CASE
                WHEN COALESCE(s.active_processes_count, 0) > 0 AND COALESCE(s.delayed_processes_count, 0) = 0 THEN 30
                WHEN COALESCE(s.active_processes_count, 0) > 0 AND COALESCE(s.delayed_processes_count, 0) > 0 THEN 15
                ELSE 10
            END
        )::INT AS health_score,
        COALESCE(f.total_receivable, 0) AS total_receivable,
        COALESCE(f.total_received, 0) AS total_received,
        COALESCE(f.total_overdue, 0) AS total_overdue
    FROM clients c
    LEFT JOIN vw_client_process_summary s ON c.id = s.client_id
    LEFT JOIN (
        SELECT
            co.client_id,
            SUM(i.amount) AS total_receivable,
            SUM(i."amountPaid") AS total_received,
            SUM(CASE WHEN i.status = 'Atrasada' THEN i.amount - i."amountPaid" ELSE 0 END) AS total_overdue
        FROM contracts co
        JOIN installments i ON co.id = i.contract_id
        GROUP BY co.client_id
    ) f ON c.id = f.client_id
    WHERE c.environment = p_environment
      AND (
        p_search_term IS NULL OR btrim(p_search_term) = '' OR
        public.immutable_unaccent(lower(coalesce(c.name, ''))) ILIKE '%' || public.immutable_unaccent(lower(p_search_term)) || '%' OR
        public.immutable_unaccent(lower(coalesce(c.document, ''))) ILIKE '%' || public.immutable_unaccent(lower(p_search_term)) || '%' OR
        public.immutable_unaccent(lower(coalesce(c.email, ''))) ILIKE '%' || public.immutable_unaccent(lower(p_search_term)) || '%' OR
        public.immutable_unaccent(lower(coalesce(array_to_string(c.tags, ','), ''))) ILIKE '%' || public.immutable_unaccent(lower(p_search_term)) || '%'
      )
    ORDER BY c.name
    LIMIT (p_to - p_from + 1) OFFSET p_from;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_clients_with_process_summary(INT, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_clients_with_process_summary(INT, INT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_clients_with_process_summary(INT, INT, TEXT, TEXT) TO service_role;

-- Índices funcionais (criados apenas se as colunas existirem; expressões alinhadas às consultas)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='name') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clients_unaccent_name_trgm ON public.clients USING gin (public.immutable_unaccent(lower(coalesce(name, ''''))) gin_trgm_ops)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='document') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clients_unaccent_document_trgm ON public.clients USING gin (public.immutable_unaccent(lower(coalesce(document, ''''))) gin_trgm_ops)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='email') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_clients_unaccent_email_trgm ON public.clients USING gin (public.immutable_unaccent(lower(coalesce(email, ''''))) gin_trgm_ops)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='processes' AND column_name='processNumber') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_processes_unaccent_process_number_trgm ON public.processes USING gin (public.immutable_unaccent(lower(coalesce("processNumber", ''''))) gin_trgm_ops)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='processes' AND column_name='number') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_processes_unaccent_number_trgm ON public.processes USING gin (public.immutable_unaccent(lower(coalesce(number::text, ''''))) gin_trgm_ops)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='processes' AND column_name='client') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_processes_unaccent_client_trgm ON public.processes USING gin (public.immutable_unaccent(lower(coalesce(client, ''''))) gin_trgm_ops)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='processes' AND column_name='court') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_processes_unaccent_court_trgm ON public.processes USING gin (public.immutable_unaccent(lower(coalesce(court, ''''))) gin_trgm_ops)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contracts' AND column_name='processNumber') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contracts_unaccent_process_number_trgm ON public.contracts USING gin (public.immutable_unaccent(lower(coalesce("processNumber", ''''))) gin_trgm_ops)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contracts' AND column_name='contractNumber') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contracts_unaccent_contract_number_trgm ON public.contracts USING gin (public.immutable_unaccent(lower(coalesce("contractNumber", ''''))) gin_trgm_ops)';
  END IF;
END $$;

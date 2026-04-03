-- 1. Criar função RPC para buscar clientes com resumo de processos
CREATE OR REPLACE FUNCTION get_clients_with_process_summary(
    p_from INT,
    p_to INT,
    p_search_term TEXT DEFAULT NULL,
    p_environment TEXT DEFAULT 'production'
)
RETURNS TABLE (
    client_data JSONB,
    active_processes_count BIGINT,
    delayed_processes_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        to_jsonb(c.*) AS client_data,
        COALESCE(s.active_processes_count, 0) AS active_processes_count,
        COALESCE(s.delayed_processes_count, 0) AS delayed_processes_count
    FROM clients c
    LEFT JOIN vw_client_process_summary s ON c.id = s.client_id
    WHERE c.environment = p_environment
      AND (p_search_term IS NULL OR c.name ILIKE '%' || p_search_term || '%')
    ORDER BY c.name
    LIMIT (p_to - p_from + 1) OFFSET p_from;
END;
$$ LANGUAGE plpgsql;

-- Grant execute on function to authenticated users
GRANT EXECUTE ON FUNCTION get_clients_with_process_summary TO authenticated;

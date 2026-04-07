-- 1. Criar função RPC para buscar clientes com resumo de processos e financeiro
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
        -- Health Score Calculation (0-100)
        (
            -- Engagement Score (0-40)
            CASE 
                WHEN c.last_contact_at IS NULL THEN 0
                WHEN c.last_contact_at > NOW() - INTERVAL '30 days' THEN 40
                WHEN c.last_contact_at > NOW() - INTERVAL '60 days' THEN 20
                ELSE 0
            END +
            -- Financial Score (0-30)
            CASE 
                WHEN COALESCE(f.total_overdue, 0) > 0 THEN 0
                WHEN COALESCE(f.total_receivable, 0) > 0 THEN 20
                ELSE 30
            END +
            -- Process Score (0-30)
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
      AND (p_search_term IS NULL OR c.name ILIKE '%' || p_search_term || '%')
    ORDER BY c.name
    LIMIT (p_to - p_from + 1) OFFSET p_from;
END;
$$ LANGUAGE plpgsql;

-- Grant execute on function to authenticated users
GRANT EXECUTE ON FUNCTION get_clients_with_process_summary TO authenticated;

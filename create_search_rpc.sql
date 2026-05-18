-- Criação da função de busca accent-insensitive
CREATE OR REPLACE FUNCTION search_clients_insensitive(
  p_search_term text,
  p_environment text,
  p_from int,
  p_to int
)
RETURNS TABLE (
  client_data jsonb,
  active_processes_count bigint,
  delayed_processes_count bigint,
  health_score float,
  total_receivable float,
  total_received float,
  total_overdue float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_jsonb(c.*) as client_data,
    (SELECT COUNT(*) FROM processes p WHERE p.client_id = c.id AND p.status = 'Ativo') as active_processes_count,
    (SELECT COUNT(*) FROM processes p WHERE p.client_id = c.id AND p.status = 'Atrasado') as delayed_processes_count,
    -- Calculando o health_score aproximado da aplicação
    (SELECT 
       CASE 
         WHEN (c.name IS NOT NULL AND c.email IS NOT NULL AND c.document IS NOT NULL) THEN 100::float
         WHEN (c.name IS NOT NULL AND (c.email IS NOT NULL OR c.document IS NOT NULL)) THEN 50::float
         ELSE 25::float
       END
    ) as health_score,
    (SELECT COALESCE(SUM(amountReceivable), 0)::float FROM contracts WHERE client_id = c.id) as total_receivable,
    (SELECT COALESCE(SUM(amountReceived), 0)::float FROM contracts WHERE client_id = c.id) as total_received,
    (SELECT COALESCE(SUM(
        (SELECT COALESCE(SUM(amount), 0) FROM installments i WHERE i.contract_id = con.id AND i.status = 'Atrasada')
    ), 0)::float FROM contracts con WHERE con.client_id = c.id) as total_overdue
  FROM clients c
  WHERE c.environment = p_environment
  AND (
    unaccent(c.name) ILIKE unaccent('%' || p_search_term || '%')
    OR unaccent(c.document) ILIKE unaccent('%' || p_search_term || '%')
    OR unaccent(c.email) ILIKE unaccent('%' || p_search_term || '%')
  )
  ORDER BY c.name
  LIMIT (p_to - p_from + 1) OFFSET p_from;
END;
$$ LANGUAGE plpgsql;

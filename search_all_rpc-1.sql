-- Cria função para busca global accent-insensitive
CREATE OR REPLACE FUNCTION search_all(p_term text, p_environment text)
RETURNS jsonb AS $$
DECLARE
  v_term text;
  v_result jsonb;
BEGIN
  v_term := lower(translate(p_term, 'áàâãéèêíïóôõúüçñÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇÑ', 'aaaaeeeiiooouucnAAAAEEEIIOOOUUCN'));
  
  WITH clients_search AS (
    SELECT jsonb_build_object('type', 'client', 'id', id, 'title', name, 'link', '/clientes/' || id) as item
    FROM clients
    WHERE environment = p_environment
    AND lower(translate(name, 'áàâãéèêíïóôõúüçñÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇÑ', 'aaaaeeeiiooouucnAAAAEEEIIOOOUUCN')) LIKE '%' || v_term || '%'
    LIMIT 3
  ),
  processes_search AS (
    SELECT jsonb_build_object('type', 'process', 'id', id, 'title', 'Processo: ' || number, 'link', '/processos') as item
    FROM processes
    WHERE environment = p_environment
    AND lower(translate(number, 'áàâãéèêíïóôõúüçñÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇÑ', 'aaaaeeeiiooouucnAAAAEEEIIOOOUUCN')) LIKE '%' || v_term || '%'
    LIMIT 3
  ),
  contracts_search AS (
    SELECT jsonb_build_object('type', 'contract', 'id', c.id, 'title', 'Financeiro: ' || coalesce(cl.name, 'Sem cliente'), 'link', '/financeiro') as item
    FROM contracts c
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE c.environment = p_environment
    AND lower(translate(cl.name, 'áàâãéèêíïóôõúüçñÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇÑ', 'aaaaeeeiiooouucnAAAAEEEIIOOOUUCN')) LIKE '%' || v_term || '%'
    LIMIT 3
  )
  SELECT jsonb_agg(item) INTO v_result
  FROM (
    SELECT item FROM clients_search
    UNION ALL
    SELECT item FROM processes_search
    UNION ALL
    SELECT item FROM contracts_search
  ) AS combined;
  
  RETURN coalesce(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION search_all TO authenticated;

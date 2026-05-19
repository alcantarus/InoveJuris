-- CRIAÇÃO DA FUNÇÃO DE BUSCA INSENSÍVEL A ACENTOS (USANDO TRANSLATE)
CREATE OR REPLACE FUNCTION search_clients_basic(
    p_term TEXT,
    p_environment TEXT,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    id INT,
    name TEXT,
    document TEXT
) AS $$
DECLARE
    v_term TEXT;
BEGIN
    -- Normaliza o termo de busca: remove acentos e coloca em minúsculas
    v_term := lower(translate(p_term, 'áàâãéèêíïóôõúüçñÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇÑ', 'aaaaeeeiiooouucnAAAAEEEIIOOOUUCN'));
    
    RETURN QUERY
    SELECT c.id, c.name, c.document
    FROM clients c
    WHERE c.environment = p_environment
    AND (
      lower(translate(c.name, 'áàâãéèêíïóôõúüçñÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇÑ', 'aaaaeeeiiooouucnAAAAEEEIIOOOUUCN')) LIKE '%' || v_term || '%'
      OR 
      lower(translate(c.document, 'áàâãéèêíïóôõúüçñÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇÑ', 'aaaaeeeiiooouucnAAAAEEEIIOOOUUCN')) LIKE '%' || v_term || '%'
    )
    ORDER BY c.name
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION search_clients_basic TO authenticated;

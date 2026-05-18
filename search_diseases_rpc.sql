-- RPC para busca de doenças, sensível a acentos (usando translate)
CREATE OR REPLACE FUNCTION search_diseases(
    p_term TEXT,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    id INT,
    cid_code TEXT,
    description TEXT
) AS $$
DECLARE
    v_term TEXT;
BEGIN
    v_term := lower(translate(p_term, 'áàâãéèêíïóôõúüçñÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇÑ', 'aaaaeeeiiooouucnAAAAEEEIIOOOUUCN'));
    
    RETURN QUERY
    SELECT d.id, d.cid_code, d.description
    FROM diseases d
    WHERE 
      lower(translate(d.cid_code, 'áàâãéèêíïóôõúüçñÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇÑ', 'aaaaeeeiiooouucnAAAAEEEIIOOOUUCN')) LIKE '%' || v_term || '%'
      OR 
      lower(translate(d.description, 'áàâãéèêíïóôõúüçñÁÀÂÃÉÈÊÍÏÓÔÕÚÜÇÑ', 'aaaaeeeiiooouucnAAAAEEEIIOOOUUCN')) LIKE '%' || v_term || '%'
    ORDER BY d.description
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION search_diseases TO authenticated;

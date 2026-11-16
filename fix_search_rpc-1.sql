-- Atualiza a função de busca de clientes para respeitar o ambiente (isolamento lógico)
CREATE OR REPLACE FUNCTION search_clients(search_term TEXT, p_environment TEXT DEFAULT 'production')
RETURNS SETOF clients AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM clients
  WHERE environment = p_environment
    AND (
      unaccent(name) ILIKE unaccent('%' || search_term || '%')
      OR unaccent(email) ILIKE unaccent('%' || search_term || '%')
      OR unaccent(document) ILIKE unaccent('%' || search_term || '%')
    );
END;
$$ LANGUAGE plpgsql;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';

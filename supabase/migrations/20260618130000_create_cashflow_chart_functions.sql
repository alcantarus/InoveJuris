-- Função para dados de gráfico por categoria
CREATE OR REPLACE FUNCTION get_financial_chart_data(
    p_start_date DATE,
    p_end_date DATE,
    p_type TEXT, -- 'income' ou 'expense'
    p_environment TEXT DEFAULT 'production'
) 
RETURNS TABLE (
    category_name TEXT,
    total_amount NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(c.name, 'Sem Categoria') as category_name,
        SUM(ft.amount) as total_amount
    FROM 
        financial_transactions ft
    LEFT JOIN 
        financial_categories c ON ft.category_id = c.id
    WHERE 
        ft.date >= p_start_date 
        AND ft.date <= p_end_date
        AND ft.environment = p_environment
        AND ft.type = p_type
    GROUP BY 
        c.name;
END;
$$ LANGUAGE plpgsql;

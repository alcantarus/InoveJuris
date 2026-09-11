-- Função para projeção de recebimentos futuros (contratos ativos)
CREATE OR REPLACE FUNCTION get_future_receivables_projection(
    p_environment TEXT DEFAULT 'production'
)
RETURNS TABLE (
    due_month TEXT,
    total_amount NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TO_CHAR(installments."dueDate"::DATE, 'YYYY-MM') as due_month,
        SUM(installments.amount) as total_amount
    FROM 
        installments
    WHERE 
        installments.status IN ('Aberto', 'Atrasada')
        AND installments."dueDate"::DATE >= CURRENT_DATE
        AND installments.environment = p_environment
    GROUP BY 
        TO_CHAR(installments."dueDate"::DATE, 'YYYY-MM')
    ORDER BY 
        due_month;
END;
$$ LANGUAGE plpgsql;

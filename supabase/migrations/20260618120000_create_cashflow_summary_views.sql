CREATE OR REPLACE FUNCTION get_financial_summary(
    p_start_date DATE,
    p_end_date DATE,
    p_account_id BIGINT DEFAULT NULL,
    p_category_id BIGINT DEFAULT NULL,
    p_environment TEXT DEFAULT 'production'
) 
RETURNS TABLE (
    transaction_type TEXT,
    total_amount NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        financial_transactions.type,
        SUM(financial_transactions.amount)
    FROM 
        financial_transactions
    WHERE 
        financial_transactions.date >= p_start_date 
        AND financial_transactions.date <= p_end_date
        AND financial_transactions.environment = p_environment
        AND (p_account_id IS NULL OR financial_transactions.account_id = p_account_id)
        AND (p_category_id IS NULL OR financial_transactions.category_id = p_category_id)
    GROUP BY 
        financial_transactions.type;
END;
$$ LANGUAGE plpgsql;

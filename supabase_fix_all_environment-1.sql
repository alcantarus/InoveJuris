-- ==============================================================================
-- SCRIPT DE CORREÇÃO GLOBAL: COLUNA ENVIRONMENT
-- ==============================================================================
-- Este script garante que TODAS as tabelas do sistema possuam a coluna 'environment',
-- permitindo o funcionamento correto do isolamento lógico entre Teste e Produção.

DO $$
DECLARE
    t text;
BEGIN
    -- Lista de todas as tabelas na schema public
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('geo_cache') -- geo_cache é global por natureza
    LOOP
        BEGIN
            -- Tenta adicionar a coluna se ela não existir
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = t AND column_name = 'environment'
            ) THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN environment TEXT DEFAULT ''production''', t);
                RAISE NOTICE 'Coluna environment adicionada à tabela %', t;
            END IF;

            -- Garante que registros nulos recebam o valor default
            EXECUTE format('UPDATE %I SET environment = ''production'' WHERE environment IS NULL', t);
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Não foi possível processar a tabela %: %', t, SQLERRM;
        END;
    END LOOP;
END $$;

-- Atualizar a view de comissões para garantir que ela use a coluna environment de contracts
DROP VIEW IF EXISTS vw_indicator_commission_status;
CREATE VIEW vw_indicator_commission_status AS
SELECT
    c.id AS contract_id,
    c.indicator_id,
    i.name AS indicator_name,
    cl.name AS client_name,
    c.environment,
    (c.base_comissao * (c."commissionPercent" / 100.0)) AS total_commission,
    COALESCE(SUM(cp.amount_paid), 0) AS total_paid,
    ((c.base_comissao * (c."commissionPercent" / 100.0)) - COALESCE(SUM(cp.amount_paid), 0)) AS remaining_balance
FROM
    contracts c
JOIN
    clients cl ON c.client_id = cl.id
JOIN
    indicators i ON c.indicator_id = i.id
LEFT JOIN
    commission_payments cp ON c.id = cp.contract_id
GROUP BY
    c.id, c.indicator_id, i.name, cl.name, c.base_comissao, c."commissionPercent", c.environment;

-- Recarregar o cache do PostgREST
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

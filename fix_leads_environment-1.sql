-- Garantir coluna environment na tabela leads
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'environment'
    ) THEN
        ALTER TABLE leads ADD COLUMN environment TEXT DEFAULT 'production';
        RAISE NOTICE 'Coluna environment adicionada à tabela leads';
    END IF;

    -- Garante que registros nulos recebam o valor default
    UPDATE leads SET environment = 'production' WHERE environment IS NULL;

    -- Garantir índice para performance
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'leads' AND indexname = 'idx_leads_environment'
    ) THEN
        CREATE INDEX idx_leads_environment ON leads(environment);
        RAISE NOTICE 'Índice idx_leads_environment criado';
    END IF;
END $$;

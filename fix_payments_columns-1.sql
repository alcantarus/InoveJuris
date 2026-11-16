-- ==============================================================================
-- SCRIPT PARA CORRIGIR COLUNA FALTANTE NA TABELA PAYMENTS
-- ==============================================================================
-- Este script garante que a coluna 'type' exista na tabela 'payments'.

DO $$
BEGIN
    -- 1. Verificar se a coluna 'type' existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'type'
    ) THEN
        ALTER TABLE payments ADD COLUMN type TEXT DEFAULT 'payment';
        RAISE NOTICE 'Coluna type adicionada à tabela payments.';
    END IF;

    -- 2. Garantir que a coluna 'environment' exista (para isolamento lógico)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'environment'
    ) THEN
        ALTER TABLE payments ADD COLUMN environment TEXT DEFAULT 'production';
        RAISE NOTICE 'Coluna environment adicionada à tabela payments.';
    END IF;

    -- 3. Garantir que a coluna 'account_id' exista
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'account_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN account_id BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL;
        RAISE NOTICE 'Coluna account_id adicionada à tabela payments.';
    END IF;

    -- 4. Garantir que a coluna 'category_id' exista
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN category_id BIGINT REFERENCES financial_categories(id) ON DELETE SET NULL;
        RAISE NOTICE 'Coluna category_id adicionada à tabela payments.';
    END IF;

END $$;

-- Recarregar o cache do PostgREST
NOTIFY pgrst, 'reload schema';

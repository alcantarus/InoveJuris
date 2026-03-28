-- ==============================================================================
-- SCRIPT PARA CORRIGIR COLUNA 'created_by' NA TABELA PAYMENTS
-- ==============================================================================
-- Este script garante que a coluna 'created_by' exista na tabela 'payments',
-- permitindo que a função process_installment_payment funcione corretamente.

DO $$
BEGIN
    -- 1. Verificar se a tabela payments existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        
        -- 2. Adicionar coluna created_by se não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'payments' AND column_name = 'created_by'
        ) THEN
            ALTER TABLE payments ADD COLUMN created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
            RAISE NOTICE 'Coluna created_by adicionada à tabela payments.';
        END IF;

        -- 3. Garantir que a coluna type exista (prevenção)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'payments' AND column_name = 'type'
        ) THEN
            ALTER TABLE payments ADD COLUMN type TEXT DEFAULT 'payment';
            RAISE NOTICE 'Coluna type adicionada à tabela payments.';
        END IF;

    END IF;
END;
$$;

-- Recarregar o cache do PostgREST
NOTIFY pgrst, 'reload schema';

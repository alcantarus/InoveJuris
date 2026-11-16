-- ==============================================================================
-- SCRIPT PARA CORRIGIR TODOS OS PROBLEMAS RELATADOS
-- ==============================================================================

DO $$
BEGIN
    -- 1. Corrigir a coluna record_id na tabela audit_logs para TEXT
    -- Isso resolve o erro: invalid input syntax for type bigint (UUIDs)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'record_id' AND data_type = 'bigint') THEN
        ALTER TABLE audit_logs ALTER COLUMN record_id TYPE TEXT;
    END IF;

    -- 2. Garantir que a tabela payments tenha as colunas de auditoria e ambiente
    -- Isso resolve o erro: column "created_by" of relation "payments" does not exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'environment') THEN
            ALTER TABLE payments ADD COLUMN environment TEXT DEFAULT 'production';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'created_by') THEN
            ALTER TABLE payments ADD COLUMN created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'updated_by') THEN
            ALTER TABLE payments ADD COLUMN updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
        END IF;
    END IF;

    -- 3. Corrigir restrições de chave estrangeira para permitir exclusão em cascata
    -- Isso resolve o erro ao excluir contratos no ambiente de testes
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'commission_payments_contract_id_fkey') THEN
        ALTER TABLE commission_payments DROP CONSTRAINT commission_payments_contract_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'commission_payments') THEN
        ALTER TABLE commission_payments 
        ADD CONSTRAINT commission_payments_contract_id_fkey 
        FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'commission_payments_indicator_id_fkey') THEN
        ALTER TABLE commission_payments DROP CONSTRAINT commission_payments_indicator_id_fkey;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'commission_payments') THEN
        ALTER TABLE commission_payments 
        ADD CONSTRAINT commission_payments_indicator_id_fkey 
        FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE;
    END IF;

    RAISE NOTICE 'Todas as correções foram aplicadas com sucesso!';
END $$;

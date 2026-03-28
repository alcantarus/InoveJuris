-- ==============================================================================
-- SCRIPT PARA CORRIGIR ERRO DE EXCLUSÃO DE CONTRATOS (CASCATA)
-- ==============================================================================
-- Este script remove a restrição antiga e adiciona uma nova com ON DELETE CASCADE.

DO $$
BEGIN
    -- 1. Corrigir vínculo com Contratos
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'commission_payments_contract_id_fkey'
    ) THEN
        ALTER TABLE commission_payments DROP CONSTRAINT commission_payments_contract_id_fkey;
    END IF;

    ALTER TABLE commission_payments 
    ADD CONSTRAINT commission_payments_contract_id_fkey 
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

    -- 2. Corrigir vínculo com Indicadores (Opcional, mas recomendado)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'commission_payments_indicator_id_fkey'
    ) THEN
        ALTER TABLE commission_payments DROP CONSTRAINT commission_payments_indicator_id_fkey;
    END IF;

    ALTER TABLE commission_payments 
    ADD CONSTRAINT commission_payments_indicator_id_fkey 
    FOREIGN KEY (indicator_id) REFERENCES indicators(id) ON DELETE CASCADE;

    RAISE NOTICE 'Restrições de chave estrangeira atualizadas para ON DELETE CASCADE.';
END $$;

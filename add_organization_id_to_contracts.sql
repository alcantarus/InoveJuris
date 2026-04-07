-- Adicionar coluna organization_id à tabela contracts
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Atualizar RLS para a tabela contracts
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to contracts" ON contracts;
CREATE POLICY "Allow all access to contracts" ON contracts FOR ALL USING (organization_id::TEXT = current_setting('custom.organization_id', true)) WITH CHECK (organization_id::TEXT = current_setting('custom.organization_id', true));

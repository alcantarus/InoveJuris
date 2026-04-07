-- Adicionar coluna organization_id à tabela clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Atualizar clientes existentes para uma organização padrão (ou a organização do usuário)
-- Como não sabemos a organização, vamos usar a primeira organização encontrada
UPDATE clients SET organization_id = (SELECT id FROM organizations LIMIT 1) WHERE organization_id IS NULL;

-- Habilitar RLS na tabela clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Criar política RLS para clients
DROP POLICY IF EXISTS "Allow all access to clients" ON clients;
CREATE POLICY "Allow all access to clients" ON clients 
FOR ALL 
USING (organization_id::TEXT = current_setting('custom.organization_id', true)) 
WITH CHECK (organization_id::TEXT = current_setting('custom.organization_id', true));

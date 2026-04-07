-- Adicionar coluna organization_id à tabela products
ALTER TABLE products ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Atualizar produtos existentes para uma organização padrão (ou a organização do usuário)
-- Como não sabemos a organização, vamos usar a primeira organização encontrada
UPDATE products SET organization_id = (SELECT id FROM organizations LIMIT 1) WHERE organization_id IS NULL;

-- Habilitar RLS na tabela products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Criar política RLS para products
DROP POLICY IF EXISTS "Allow all access to products" ON products;
CREATE POLICY "Allow all access to products" ON products 
FOR ALL 
USING (organization_id::TEXT = current_setting('custom.organization_id', true)) 
WITH CHECK (organization_id::TEXT = current_setting('custom.organization_id', true));

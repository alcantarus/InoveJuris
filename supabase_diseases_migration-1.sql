-- 1. Tabela de Doenças (Cadastro Base)
CREATE TABLE IF NOT EXISTS diseases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cid_code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    accessory_cids JSONB DEFAULT '[]',
    environment TEXT DEFAULT 'production',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Junção (Relacionamento Produto <-> Doença)
CREATE TABLE IF NOT EXISTS product_diseases (
    product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
    disease_id UUID REFERENCES diseases(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, disease_id)
);

-- Habilitar RLS (Segurança)
ALTER TABLE diseases ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_diseases ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (Seguindo o padrão do sistema)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to diseases' AND tablename = 'diseases') THEN
        CREATE POLICY "Allow all access to diseases" ON diseases FOR ALL USING (true) WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to product_diseases' AND tablename = 'product_diseases') THEN
        CREATE POLICY "Allow all access to product_diseases" ON product_diseases FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

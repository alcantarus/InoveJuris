-- Tabela de Junção (Relacionamento Contrato <-> Doença)
CREATE TABLE IF NOT EXISTS contract_diseases (
    contract_id BIGINT REFERENCES contracts(id) ON DELETE CASCADE,
    disease_id UUID REFERENCES diseases(id) ON DELETE CASCADE,
    PRIMARY KEY (contract_id, disease_id)
);

-- Habilitar RLS (Segurança)
ALTER TABLE contract_diseases ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to contract_diseases' AND tablename = 'contract_diseases') THEN
        CREATE POLICY "Allow all access to contract_diseases" ON contract_diseases FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

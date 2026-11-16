-- 1. Adicionar coluna canAccessContracts na tabela users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'canAccessContracts') THEN
        ALTER TABLE users ADD COLUMN "canAccessContracts" BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Inserir permissão access_contracts na tabela permissions
INSERT INTO permissions (slug, description)
VALUES ('access_contracts', 'Acesso ao módulo de Contratos')
ON CONFLICT (slug) DO NOTHING;

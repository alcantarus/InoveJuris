-- Adicionar coluna 'name' na tabela 'lawyers' para permitir advogados não vinculados a usuários
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lawyers' AND column_name = 'name') THEN
        ALTER TABLE lawyers ADD COLUMN name TEXT;
    END IF;
END $$;

-- Notificar o PostgREST para recarregar o cache de schema
NOTIFY pgrst, 'reload config';

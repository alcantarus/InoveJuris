-- Script definitivo para corrigir a tabela birthday_templates
-- Transforma o ID em UUID e garante todas as colunas necessárias

-- 1. Habilitar extensão para UUIDs se não estiver
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Corrigir o tipo da coluna ID
DO $$
BEGIN
    -- Se a coluna id for bigint, vamos convertê-la
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'birthday_templates' 
        AND column_name = 'id' 
        AND data_type = 'bigint'
    ) THEN
        -- Remove o padrão antigo (sequence)
        ALTER TABLE birthday_templates ALTER COLUMN id DROP DEFAULT;
        
        -- Converte para UUID gerando novos valores para os registros existentes
        -- ATENÇÃO: Isso mudará os IDs dos templates já existentes!
        ALTER TABLE birthday_templates 
        ALTER COLUMN id TYPE UUID USING gen_random_uuid();
        
        -- Define o novo padrão
        ALTER TABLE birthday_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;
END $$;

-- 3. Garantir que todas as colunas de estilo existam
DO $$
BEGIN
    -- Fontes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'msg_font') THEN
        ALTER TABLE birthday_templates ADD COLUMN msg_font TEXT DEFAULT 'sans-serif';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'name_font') THEN
        ALTER TABLE birthday_templates ADD COLUMN name_font TEXT DEFAULT 'sans-serif';
    END IF;

    -- Cores e Posições (Garantia extra)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'text_color') THEN
        ALTER TABLE birthday_templates ADD COLUMN text_color TEXT DEFAULT '#000000';
    END IF;
END $$;

-- 4. Recarregar cache do esquema
NOTIFY pgrst, 'reload config';

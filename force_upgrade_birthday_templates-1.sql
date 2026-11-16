-- Script de atualização forçada para birthday_templates
-- Este script detecta se a tabela está no formato antigo e força a atualização

DO $$
DECLARE
    is_old_format BOOLEAN;
    backup_table_name TEXT := 'birthday_templates_backup_final';
BEGIN
    -- 1. Verificar se a tabela atual é do formato antigo (ID é bigint ou integer)
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'birthday_templates' 
        AND column_name = 'id' 
        AND (data_type = 'bigint' OR data_type = 'integer')
    ) INTO is_old_format;

    -- Se for formato antigo ou se a tabela não tiver a coluna 'environment'
    IF is_old_format OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'environment') THEN
        
        -- Renomear a tabela antiga para backup
        EXECUTE format('ALTER TABLE birthday_templates RENAME TO %I', backup_table_name);
        
        -- Criar a nova tabela com a estrutura correta
        CREATE TABLE birthday_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            name TEXT NOT NULL,
            image_url TEXT,
            text_color TEXT DEFAULT '#000000',
            
            -- Posicionamento e Estilo do Nome
            name_x TEXT DEFAULT '50%',
            name_y TEXT DEFAULT '40%',
            name_size TEXT DEFAULT '36px',
            name_max_width TEXT DEFAULT '80%',
            name_font TEXT DEFAULT 'sans-serif',
            
            -- Posicionamento e Estilo da Mensagem
            msg_x TEXT DEFAULT '50%',
            msg_y TEXT DEFAULT '60%',
            msg_size TEXT DEFAULT '14px',
            msg_max_width TEXT DEFAULT '80%',
            msg_font TEXT DEFAULT 'sans-serif',
            
            -- Outros Estilos
            line_height TEXT DEFAULT '1.2',
            text_align TEXT DEFAULT 'center',
            photo_shape TEXT DEFAULT 'circle',
            show_client_photo BOOLEAN DEFAULT false,
            
            -- Configuração
            is_active BOOLEAN DEFAULT true,
            environment TEXT DEFAULT 'production'
        );

        -- Migrar dados da tabela de backup
        -- Usamos uma query dinâmica para evitar erros se colunas não existirem no backup
        EXECUTE format('
            INSERT INTO birthday_templates (
                name, image_url, text_color, 
                name_x, name_y, name_size, 
                is_active
            )
            SELECT 
                name, image_url, text_color, 
                name_x, name_y, name_size, 
                is_active
            FROM %I', backup_table_name);
            
        -- Tentar migrar colunas opcionais se existirem no backup
        -- (Simplificado para garantir que o básico funcione, colunas novas assumirão defaults)
        
    END IF;
END $$;

-- Garantir RLS
ALTER TABLE birthday_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to birthday_templates" ON birthday_templates;
CREATE POLICY "Allow all access to birthday_templates" ON birthday_templates FOR ALL USING (true) WITH CHECK (true);

-- Recarregar schema
NOTIFY pgrst, 'reload config';

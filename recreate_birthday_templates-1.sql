-- Script de RECRIAÇÃO da tabela birthday_templates
-- Use este script se a conversão de ID falhar.
-- ATENÇÃO: Isso vai gerar NOVOS IDs para os templates existentes.

-- 1. Renomear a tabela atual para backup (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'birthday_templates') THEN
        ALTER TABLE birthday_templates RENAME TO birthday_templates_backup_v2;
    END IF;
END $$;

-- 2. Criar a tabela nova com a estrutura CORRETA (UUID)
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

-- 3. Copiar dados do backup (se existir), ignorando o ID antigo (gerando novos UUIDs)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'birthday_templates_backup_v2') THEN
        INSERT INTO birthday_templates (
            name, image_url, text_color, 
            name_x, name_y, name_size, name_max_width, name_font,
            msg_x, msg_y, msg_size, msg_max_width, msg_font,
            line_height, text_align, photo_shape, show_client_photo, 
            is_active
        )
        SELECT 
            name, image_url, text_color, 
            name_x, name_y, name_size, name_max_width, name_font,
            msg_x, msg_y, msg_size, msg_max_width, msg_font,
            line_height, text_align, photo_shape, show_client_photo, 
            is_active
        FROM birthday_templates_backup_v2;
    END IF;
END $$;

-- 4. Habilitar segurança (RLS)
ALTER TABLE birthday_templates ENABLE ROW LEVEL SECURITY;

-- 5. Criar política de acesso total (ajuste conforme necessidade de segurança)
DROP POLICY IF EXISTS "Allow all access to birthday_templates" ON birthday_templates;
CREATE POLICY "Allow all access to birthday_templates" ON birthday_templates FOR ALL USING (true) WITH CHECK (true);

-- 6. Recarregar configurações
NOTIFY pgrst, 'reload config';

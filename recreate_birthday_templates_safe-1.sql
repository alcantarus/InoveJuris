-- Script final e seguro para recriar a tabela birthday_templates
-- Este script trata o caso onde a tabela de backup não tem todas as colunas novas

-- 1. Garantir que a tabela nova existe com a estrutura correta
CREATE TABLE IF NOT EXISTS birthday_templates (
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

-- 2. Migrar os dados de forma segura, verificando quais colunas existem no backup
DO $$
DECLARE
    col_exists_photo_shape BOOLEAN;
    col_exists_show_client_photo BOOLEAN;
    col_exists_msg_font BOOLEAN;
    col_exists_name_font BOOLEAN;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'birthday_templates_backup_v2') THEN
        
        -- Verificar existência de colunas problemáticas no backup
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates_backup_v2' AND column_name = 'photo_shape') INTO col_exists_photo_shape;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates_backup_v2' AND column_name = 'show_client_photo') INTO col_exists_show_client_photo;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates_backup_v2' AND column_name = 'msg_font') INTO col_exists_msg_font;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates_backup_v2' AND column_name = 'name_font') INTO col_exists_name_font;

        -- Inserir dados usando COALESCE e valores default para colunas que podem não existir no backup
        EXECUTE format('
            INSERT INTO birthday_templates (
                name, image_url, text_color, 
                name_x, name_y, name_size, name_max_width, name_font,
                msg_x, msg_y, msg_size, msg_max_width, msg_font,
                line_height, text_align, photo_shape, show_client_photo, 
                is_active
            )
            SELECT 
                name, image_url, text_color, 
                name_x, name_y, name_size, name_max_width, %s,
                msg_x, msg_y, msg_size, msg_max_width, %s,
                line_height, text_align, %s, %s, 
                is_active
            FROM birthday_templates_backup_v2;
        ', 
        CASE WHEN col_exists_name_font THEN 'name_font' ELSE '''sans-serif''' END,
        CASE WHEN col_exists_msg_font THEN 'msg_font' ELSE '''sans-serif''' END,
        CASE WHEN col_exists_photo_shape THEN 'photo_shape' ELSE '''circle''' END,
        CASE WHEN col_exists_show_client_photo THEN 'show_client_photo' ELSE 'false' END
        );
        
        -- Opcional: Remover a tabela de backup após a migração bem-sucedida
        -- DROP TABLE birthday_templates_backup_v2;
    END IF;
END $$;

-- 3. Habilitar segurança (RLS)
ALTER TABLE birthday_templates ENABLE ROW LEVEL SECURITY;

-- 4. Criar política de acesso total (ajuste conforme necessidade de segurança)
DROP POLICY IF EXISTS "Allow all access to birthday_templates" ON birthday_templates;
CREATE POLICY "Allow all access to birthday_templates" ON birthday_templates FOR ALL USING (true) WITH CHECK (true);

-- 5. Recarregar configurações
NOTIFY pgrst, 'reload config';

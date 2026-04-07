-- Script de Limpeza e Recriação TOTAL da tabela birthday_templates
-- ATENÇÃO: Se houver dados na tabela atual, eles serão perdidos.
-- Use isso apenas se os scripts de migração anteriores falharam repetidamente.

-- 1. Remover a tabela atual (e suas políticas/triggers) completamente
DROP TABLE IF EXISTS birthday_templates CASCADE;

-- 2. Criar a tabela do zero com a estrutura exata que o frontend espera
CREATE TABLE birthday_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Dados Básicos
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
    
    -- Outros Estilos (que o frontend não envia no insert, mas precisa existir)
    line_height TEXT DEFAULT '1.2',
    text_align TEXT DEFAULT 'center',
    photo_shape TEXT DEFAULT 'circle',
    show_client_photo BOOLEAN DEFAULT false,
    
    -- Configuração
    is_active BOOLEAN DEFAULT true
);

-- 3. Habilitar segurança (RLS)
ALTER TABLE birthday_templates ENABLE ROW LEVEL SECURITY;

-- 4. Criar política de acesso total (ajuste conforme necessidade de segurança)
DROP POLICY IF EXISTS "Allow all access to birthday_templates" ON birthday_templates;
CREATE POLICY "Allow all access to birthday_templates" ON birthday_templates FOR ALL USING (true) WITH CHECK (true);

-- 5. Forçar o PostgREST a recarregar o schema imediatamente
NOTIFY pgrst, 'reload config';

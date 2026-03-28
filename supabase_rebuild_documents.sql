-- ==============================================================================
-- SCRIPT "SOLUÇÃO DEFINITIVA" (RECRIAÇÃO COMPLETA DAS TABELAS DE DOCUMENTOS)
-- ==============================================================================
-- ATENÇÃO: Este script irá APAGAR todos os modelos de documentos existentes para garantir
-- que a estrutura do banco de dados esteja 100% correta e compatível.
-- Isso resolve conflitos de tipos (UUID vs BIGINT) e permissões (RLS) de uma vez por todas.

-- 1. Remove as tabelas antigas (com CASCADE para remover dependências)
DROP TABLE IF EXISTS template_variables CASCADE;
DROP TABLE IF EXISTS document_templates CASCADE;

-- 2. Recria a tabela de MODELOS (document_templates)
CREATE TABLE document_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    file_url TEXT NOT NULL,
    environment TEXT DEFAULT 'production',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Recria a tabela de VARIÁVEIS (template_variables)
CREATE TABLE template_variables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    variable_tag TEXT NOT NULL,
    data_source_path TEXT,
    data_type TEXT DEFAULT 'String',
    environment TEXT DEFAULT 'production',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilita Segurança (RLS) em ambas as tabelas
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_variables ENABLE ROW LEVEL SECURITY;

-- 5. Cria Políticas de Acesso PERMISSIVAS (para evitar bloqueios durante o desenvolvimento)
-- Permite que qualquer usuário (autenticado ou anônimo) leia e escreva nessas tabelas.
-- Em produção real, você pode restringir isso depois, mas agora o foco é fazer funcionar.

-- Políticas para document_templates
CREATE POLICY "Enable all access for everyone" ON document_templates
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Políticas para template_variables
CREATE POLICY "Enable all access for everyone" ON template_variables
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 6. Garante que o bucket de armazenamento exista e tenha permissões
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates', 
  'templates', 
  true, 
  10485760, 
  ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- Políticas de Storage (Permissivas)
DROP POLICY IF EXISTS "Public Access Templates" ON storage.objects;
CREATE POLICY "Public Access Templates" ON storage.objects FOR SELECT USING ( bucket_id = 'templates' );

DROP POLICY IF EXISTS "Authenticated Upload Templates" ON storage.objects;
CREATE POLICY "Authenticated Upload Templates" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'templates' );

DROP POLICY IF EXISTS "Authenticated Delete Templates" ON storage.objects;
CREATE POLICY "Authenticated Delete Templates" ON storage.objects FOR DELETE USING ( bucket_id = 'templates' );

DROP POLICY IF EXISTS "Authenticated Update Templates" ON storage.objects;
CREATE POLICY "Authenticated Update Templates" ON storage.objects FOR UPDATE USING ( bucket_id = 'templates' );

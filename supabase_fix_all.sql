-- ==============================================================================
-- SCRIPT DE CORREÇÃO GERAL DE PERMISSÕES (STORAGE + BANCO DE DADOS)
-- ==============================================================================
-- Rode este script completo no SQL Editor do Supabase para corrigir o erro RLS.

-- ------------------------------------------------------------------------------
-- 1. CORREÇÃO DO STORAGE (BUCKET 'TEMPLATES')
-- ------------------------------------------------------------------------------

-- Cria o bucket se não existir
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

-- Políticas de Storage
DROP POLICY IF EXISTS "Public Access Templates" ON storage.objects;
CREATE POLICY "Public Access Templates" ON storage.objects FOR SELECT USING ( bucket_id = 'templates' );

DROP POLICY IF EXISTS "Authenticated Upload Templates" ON storage.objects;
CREATE POLICY "Authenticated Upload Templates" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'templates' );

DROP POLICY IF EXISTS "Authenticated Delete Templates" ON storage.objects;
CREATE POLICY "Authenticated Delete Templates" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'templates' );

DROP POLICY IF EXISTS "Authenticated Update Templates" ON storage.objects;
CREATE POLICY "Authenticated Update Templates" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'templates' );

-- ------------------------------------------------------------------------------
-- 2. CORREÇÃO DAS TABELAS DO BANCO DE DADOS
-- ------------------------------------------------------------------------------

-- Tabela: document_templates
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON document_templates;
CREATE POLICY "Enable all access for authenticated users" ON document_templates
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Tabela: template_variables
ALTER TABLE template_variables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON template_variables;
CREATE POLICY "Enable all access for authenticated users" ON template_variables
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Tabela: clients (Garantindo acesso também)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON clients;
CREATE POLICY "Enable all access for authenticated users" ON clients
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- SCRIPT DE CONFIGURAÇÃO DO STORAGE (BUCKET 'TEMPLATES')
-- ==============================================================================
-- Copie e cole este código no SQL Editor do seu painel Supabase para corrigir o erro.

-- 1. Cria o bucket 'templates' se ele não existir
-- Define como público, limite de 10MB e aceita apenas arquivos .docx
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates', 
  'templates', 
  true, 
  10485760, -- 10MB
  ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- 2. Habilita RLS (Row Level Security) para garantir que as políticas funcionem
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Configura as Políticas de Segurança (Policies)

-- PERMISSÃO DE LEITURA: Pública (qualquer pessoa com o link pode baixar o modelo)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'templates' );

-- PERMISSÃO DE UPLOAD: Pública (necessário pois o app usa auth customizado com chave anon)
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'templates' );

-- PERMISSÃO DE EXCLUSÃO: Pública
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
CREATE POLICY "Public Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'templates' );

-- PERMISSÃO DE ATUALIZAÇÃO: Pública
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
CREATE POLICY "Public Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'templates' );

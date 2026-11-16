-- ==============================================================================
-- SCRIPT FINAL DE CORREÇÃO DO STORAGE (SAFE MODE)
-- ==============================================================================
-- Este script cria o bucket 'templates' e define as permissões necessárias
-- sem tentar alterar tabelas de sistema protegidas.

-- 1. Cria o bucket 'templates' (se não existir)
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

-- 2. Configura as Políticas de Segurança (Policies)

-- Remove políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Public Access Templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Templates" ON storage.objects;

-- PERMISSÃO DE LEITURA: Pública (qualquer pessoa com o link pode baixar)
CREATE POLICY "Public Access Templates"
ON storage.objects FOR SELECT
USING ( bucket_id = 'templates' );

-- PERMISSÃO DE UPLOAD: Apenas usuários autenticados
CREATE POLICY "Authenticated Upload Templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'templates' );

-- PERMISSÃO DE EXCLUSÃO: Apenas usuários autenticados
CREATE POLICY "Authenticated Delete Templates"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'templates' );

-- PERMISSÃO DE ATUALIZAÇÃO: Apenas usuários autenticados
CREATE POLICY "Authenticated Update Templates"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'templates' );

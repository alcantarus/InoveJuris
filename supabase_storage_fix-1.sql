-- ==============================================================================
-- SCRIPT DE CORREÇÃO DO STORAGE (SEM ALTERAR TABELAS DO SISTEMA)
-- ==============================================================================

-- 1. Cria ou atualiza o bucket 'templates'
-- Removemos o comando ALTER TABLE que causava o erro de permissão.
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
-- Nota: O RLS (Row Level Security) já vem habilitado por padrão no Supabase.

-- Remove políticas antigas para evitar conflitos (se existirem)
DROP POLICY IF EXISTS "Public Access Templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Templates" ON storage.objects;

-- PERMISSÃO DE LEITURA: Pública
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

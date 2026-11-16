-- ==============================================================================
-- SCRIPT PARA CORRIGIR O ERRO DE SCHEMA (COLUNA ENVIRONMENT)
-- ==============================================================================
-- O sistema utiliza uma coluna chamada 'environment' para separar dados de Teste e Produção.
-- O erro ocorre porque essa coluna está faltando nas tabelas de documentos.
-- Rode este script para adicionar as colunas faltantes.

-- 1. Adiciona a coluna 'environment' na tabela document_templates
ALTER TABLE document_templates 
ADD COLUMN IF NOT EXISTS environment text DEFAULT 'production';

-- 2. Adiciona a coluna 'environment' na tabela template_variables
ALTER TABLE template_variables 
ADD COLUMN IF NOT EXISTS environment text DEFAULT 'production';

-- 3. Adiciona a coluna 'environment' na tabela product_diseases
ALTER TABLE product_diseases 
ADD COLUMN IF NOT EXISTS environment text DEFAULT 'production';

-- 4. Atualiza o cache do esquema do Supabase (para reconhecer a nova coluna imediatamente)
NOTIFY pgrst, 'reload config';

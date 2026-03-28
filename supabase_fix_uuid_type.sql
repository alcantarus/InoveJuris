-- ==============================================================================
-- SCRIPT DE CORREÇÃO DE TIPOS (UUID vs BIGINT)
-- ==============================================================================
-- O erro ocorre porque o ID do modelo é um UUID (texto), mas a tabela de variáveis
-- espera um número (BIGINT). Este script corrige o tipo da coluna.

-- 1. Altera a coluna template_id para UUID na tabela template_variables
-- O 'USING' converte os dados existentes (se houver) para o novo tipo
ALTER TABLE template_variables 
ALTER COLUMN template_id TYPE uuid USING template_id::text::uuid;

-- 2. Recria a chave estrangeira para garantir integridade
-- Remove a constraint antiga se existir (para evitar erros de duplicidade ou tipo incorreto)
ALTER TABLE template_variables DROP CONSTRAINT IF EXISTS template_variables_template_id_fkey;

-- Adiciona a constraint correta apontando para document_templates(id)
ALTER TABLE template_variables
ADD CONSTRAINT template_variables_template_id_fkey
FOREIGN KEY (template_id)
REFERENCES document_templates(id)
ON DELETE CASCADE;

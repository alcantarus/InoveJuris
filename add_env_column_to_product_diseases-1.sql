-- Adicionar a coluna environment na tabela product_diseases
ALTER TABLE product_diseases ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production';

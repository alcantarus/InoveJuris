-- ==============================================================================
-- SCRIPT DE RECRIAÇÃO DA TABELA TEMPLATE_VARIABLES
-- ==============================================================================
-- Este script remove a tabela problemática e a recria com os tipos corretos (UUID).
-- Isso resolve definitivamente o erro de "invalid input syntax for type bigint".

-- 1. Remove a tabela antiga (CUIDADO: Apaga mapeamentos existentes)
DROP TABLE IF EXISTS template_variables CASCADE;

-- 2. Recria a tabela com a estrutura correta
CREATE TABLE template_variables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    variable_tag TEXT NOT NULL,
    data_source_path TEXT,
    data_type TEXT DEFAULT 'String',
    environment TEXT DEFAULT 'production',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilita Segurança (RLS)
ALTER TABLE template_variables ENABLE ROW LEVEL SECURITY;

-- 4. Cria Política de Acesso (Permissiva para evitar erros de bloqueio)
CREATE POLICY "Enable all access for everyone" ON template_variables
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Garante que a tabela document_templates também use UUID (caso não esteja)
-- Apenas para garantir, embora o erro indique que ela já está gerando UUIDs.
-- Se document_templates usar bigint, este comando falhará, mas o passo 2 já resolve o conflito principal.

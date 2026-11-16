-- ==============================================================================
-- FASE 1: FUNDAÇÃO DO KANBAN (BANCO DE DADOS)
-- Este script cria a estrutura base para o sistema Kanban no InoveJuris.
-- Ele é seguro (Non-Breaking) e não apaga nenhum dado existente.
-- ==============================================================================

-- 1. Criar tabela de Quadros (Boards)
CREATE TABLE IF NOT EXISTS kanban_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    module TEXT NOT NULL, -- Ex: 'processes', 'deadlines', 'clients'
    environment TEXT DEFAULT 'production'
);

-- 2. Criar tabela de Colunas/Fases (Columns)
CREATE TABLE IF NOT EXISTS kanban_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    board_id UUID NOT NULL REFERENCES kanban_boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    color TEXT DEFAULT '#e2e8f0', -- Cor padrão (slate-200)
    position INTEGER NOT NULL, -- Ordem da coluna na tela (1, 2, 3...)
    is_done_column BOOLEAN DEFAULT false -- Se true, mover para cá significa "Concluído"
);

-- 3. Adicionar campos Kanban na tabela de Processos (processes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processes' AND column_name = 'kanban_column_id') THEN
        ALTER TABLE processes ADD COLUMN kanban_column_id UUID REFERENCES kanban_columns(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processes' AND column_name = 'kanban_order') THEN
        ALTER TABLE processes ADD COLUMN kanban_order DOUBLE PRECISION;
    END IF;
END $$;

-- 4. Adicionar campos Kanban na tabela de Tarefas/Prazos (process_deadlines) - Preparação futura
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'process_deadlines') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'process_deadlines' AND column_name = 'kanban_column_id') THEN
            ALTER TABLE process_deadlines ADD COLUMN kanban_column_id UUID REFERENCES kanban_columns(id) ON DELETE SET NULL;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'process_deadlines' AND column_name = 'kanban_order') THEN
            ALTER TABLE process_deadlines ADD COLUMN kanban_order DOUBLE PRECISION;
        END IF;
    END IF;
END $$;

-- 5. Habilitar RLS (Row Level Security) nas novas tabelas
ALTER TABLE kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas de acesso total (Ajuste conforme a necessidade de segurança do seu app)
DROP POLICY IF EXISTS "Allow all access to kanban_boards" ON kanban_boards;
CREATE POLICY "Allow all access to kanban_boards" ON kanban_boards FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to kanban_columns" ON kanban_columns;
CREATE POLICY "Allow all access to kanban_columns" ON kanban_columns FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- SCRIPT DE MIGRAÇÃO (SEEDING)
-- Cria um quadro padrão para processos e mapeia os status existentes.
-- ==============================================================================
DO $$
DECLARE
    default_board_id UUID;
    col_inicial_id UUID;
    col_andamento_id UUID;
    col_suspenso_id UUID;
    col_encerrado_id UUID;
BEGIN
    -- Verificar se já existe um quadro de processos para não duplicar
    SELECT id INTO default_board_id FROM kanban_boards WHERE module = 'processes' AND environment = 'production' LIMIT 1;
    
    IF default_board_id IS NULL THEN
        -- Criar o Quadro Padrão
        INSERT INTO kanban_boards (name, module, environment) 
        VALUES ('Fluxo de Processos Principal', 'processes', 'production') 
        RETURNING id INTO default_board_id;

        -- Criar as Colunas Padrão baseadas nos status comuns do sistema
        INSERT INTO kanban_columns (board_id, title, color, position, is_done_column) VALUES 
        (default_board_id, 'Petição Inicial / Análise', '#3b82f6', 1, false) RETURNING id INTO col_inicial_id; -- blue-500
        
        INSERT INTO kanban_columns (board_id, title, color, position, is_done_column) VALUES 
        (default_board_id, 'Em Andamento', '#f59e0b', 2, false) RETURNING id INTO col_andamento_id; -- amber-500
        
        INSERT INTO kanban_columns (board_id, title, color, position, is_done_column) VALUES 
        (default_board_id, 'Suspenso / Sobrestado', '#64748b', 3, false) RETURNING id INTO col_suspenso_id; -- slate-500
        
        INSERT INTO kanban_columns (board_id, title, color, position, is_done_column) VALUES 
        (default_board_id, 'Encerrado / Arquivado', '#10b981', 4, true) RETURNING id INTO col_encerrado_id; -- emerald-500

        -- Mapear os processos existentes para as novas colunas (Migração Suave)
        -- Assumindo que o campo atual se chama 'status' e contém textos como 'Ativo', 'Encerrado', etc.
        -- Se o campo status não existir ou tiver valores diferentes, os processos ficarão sem coluna (null)
        -- e poderão ser movidos manualmente depois.
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processes' AND column_name = 'status') THEN
            -- Processos Ativos -> Em Andamento
            UPDATE processes SET kanban_column_id = col_andamento_id, kanban_order = EXTRACT(EPOCH FROM created_at) 
            WHERE status ILIKE '%ativo%' OR status ILIKE '%andamento%';
            
            -- Processos Suspensos -> Suspenso
            UPDATE processes SET kanban_column_id = col_suspenso_id, kanban_order = EXTRACT(EPOCH FROM created_at) 
            WHERE status ILIKE '%suspenso%' OR status ILIKE '%sobrestado%';
            
            -- Processos Encerrados -> Encerrado
            UPDATE processes SET kanban_column_id = col_encerrado_id, kanban_order = EXTRACT(EPOCH FROM created_at) 
            WHERE status ILIKE '%encerrado%' OR status ILIKE '%arquivado%' OR status ILIKE '%concluído%';
            
            -- Qualquer outro processo que sobrou (sem status claro) vai para a primeira coluna
            UPDATE processes SET kanban_column_id = col_inicial_id, kanban_order = EXTRACT(EPOCH FROM created_at) 
            WHERE kanban_column_id IS NULL;
        END IF;
    END IF;
END $$;

-- Recarregar o schema do PostgREST para que a API reconheça as novas tabelas e colunas
NOTIFY pgrst, 'reload config';

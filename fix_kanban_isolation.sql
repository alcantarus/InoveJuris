-- ==============================================================================
-- SCRIPT DE CORREÇÃO: ISOLAMENTO KANBAN + FIX AUDITORIA
-- ==============================================================================

-- 1. CORREÇÃO DO SISTEMA DE AUDITORIA (Suporte a UUID)
-- Altera a coluna record_id para TEXT para suportar tanto BIGINT quanto UUID
ALTER TABLE audit_logs ALTER COLUMN record_id TYPE TEXT USING record_id::TEXT;

-- Atualiza a função log_audit_event para tratar record_id como TEXT
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  changed_fields JSONB;
  performed_by BIGINT;
  record_id TEXT;
  v_env TEXT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    new_data = to_jsonb(NEW);
    old_data = null;
    changed_fields = null;
    
    IF new_data ? 'created_by' THEN
      performed_by = (new_data->>'created_by')::BIGINT;
    ELSE
      performed_by = NULL;
    END IF;
    
    IF new_data ? 'environment' AND new_data->>'environment' IS NOT NULL THEN
      v_env = new_data->>'environment';
    ELSE
      v_env = 'production';
    END IF;
    
    record_id = new_data->>'id';
  ELSIF (TG_OP = 'UPDATE') THEN
    new_data = to_jsonb(NEW);
    old_data = to_jsonb(OLD);
    SELECT jsonb_object_agg(key, value) INTO changed_fields
    FROM jsonb_each(new_data)
    WHERE old_data->key IS DISTINCT FROM value;
    
    IF new_data ? 'updated_by' THEN
      performed_by = (new_data->>'updated_by')::BIGINT;
    ELSIF new_data ? 'created_by' THEN
      performed_by = (new_data->>'created_by')::BIGINT;
    ELSE
      performed_by = NULL;
    END IF;
    
    IF new_data ? 'environment' AND new_data->>'environment' IS NOT NULL THEN
      v_env = new_data->>'environment';
    ELSE
      v_env = 'production';
    END IF;
    
    record_id = new_data->>'id';
  ELSIF (TG_OP = 'DELETE') THEN
    new_data = null;
    old_data = to_jsonb(OLD);
    changed_fields = null;
    performed_by = NULL;
    
    IF old_data ? 'environment' AND old_data->>'environment' IS NOT NULL THEN
      v_env = old_data->>'environment';
    ELSE
      v_env = 'production';
    END IF;
    
    record_id = old_data->>'id';
  END IF;

  INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, performed_by, environment)
  VALUES (TG_TABLE_NAME, record_id, TG_OP, old_data, new_data, changed_fields, performed_by, v_env);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. ISOLAMENTO LÓGICO DO KANBAN
-- Adicionar coluna environment na tabela kanban_columns
ALTER TABLE kanban_columns ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production';

-- Atualizar colunas existentes para herdar o ambiente do quadro (board)
UPDATE kanban_columns c
SET environment = b.environment
FROM kanban_boards b
WHERE c.board_id = b.id;

-- Garantir que o quadro de processos exista para ambos os ambientes
DO $$
DECLARE
    prod_board_id UUID;
    test_board_id UUID;
BEGIN
    -- Garantir quadro de Produção
    SELECT id INTO prod_board_id FROM kanban_boards WHERE module = 'processes' AND environment = 'production' LIMIT 1;
    IF prod_board_id IS NULL THEN
        INSERT INTO kanban_boards (name, module, environment) 
        VALUES ('Fluxo de Processos Principal', 'processes', 'production') 
        RETURNING id INTO prod_board_id;
        
        INSERT INTO kanban_columns (board_id, title, color, position, is_done_column, environment) VALUES 
        (prod_board_id, 'Petição Inicial / Análise', '#3b82f6', 1, false, 'production'),
        (prod_board_id, 'Em Andamento', '#f59e0b', 2, false, 'production'),
        (prod_board_id, 'Suspenso / Sobrestado', '#64748b', 3, false, 'production'),
        (prod_board_id, 'Encerrado / Arquivado', '#10b981', 4, true, 'production');
    END IF;

    -- Garantir quadro de Testes
    SELECT id INTO test_board_id FROM kanban_boards WHERE module = 'processes' AND environment = 'test' LIMIT 1;
    IF test_board_id IS NULL THEN
        INSERT INTO kanban_boards (name, module, environment) 
        VALUES ('Fluxo de Processos (Testes)', 'processes', 'test') 
        RETURNING id INTO test_board_id;
        
        INSERT INTO kanban_columns (board_id, title, color, position, is_done_column, environment) VALUES 
        (test_board_id, 'Petição Inicial / Análise', '#3b82f6', 1, false, 'test'),
        (test_board_id, 'Em Andamento', '#f59e0b', 2, false, 'test'),
        (test_board_id, 'Suspenso / Sobrestado', '#64748b', 3, false, 'test'),
        (test_board_id, 'Encerrado / Arquivado', '#10b981', 4, true, 'test');
    END IF;
END $$;

-- Recarregar cache
NOTIFY pgrst, 'reload config';

-- 3. FUNÇÕES E POLÍTICAS DE ISOLAMENTO MULTI-TENANT
-- Função para definir a organização no contexto da sessão
CREATE OR REPLACE FUNCTION public.set_app_organization(org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM set_config('custom.organization_id', org_id::text, false);
END;
$function$;

-- Função para definir o ambiente no contexto da sessão
CREATE OR REPLACE FUNCTION public.set_app_environment(env_name text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM set_config('app.current_env', env_name, false);
END;
$function$;

-- Políticas para audit_logs
DROP POLICY IF EXISTS "Enable insert for server-side auth" ON audit_logs;
CREATE POLICY "Enable insert for server-side auth" ON audit_logs 
FOR INSERT WITH CHECK (true);

-- Garantir que a política de RLS esteja correta e robusta
DROP POLICY IF EXISTS "Isolamento por Tenant em kanban_boards" ON kanban_boards;

CREATE POLICY "Isolamento por Tenant em kanban_boards" ON kanban_boards
FOR ALL
USING (organization_id::TEXT = current_setting('custom.organization_id', true))
WITH CHECK (
    -- Permite inserção se o ID da organização enviado for igual ao da sessão
    organization_id::TEXT = current_setting('custom.organization_id', true)
);

-- 4. ISOLAMENTO MULTI-TENANT E POR AMBIENTE NA TABELA LAWYERS
-- Adicionar coluna organization_id (já feita)
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Adicionar coluna environment
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production';

-- Atualizar políticas de RLS para a tabela lawyers (Isolamento duplo)
DROP POLICY IF EXISTS "Allow all for lawyers" ON lawyers;
DROP POLICY IF EXISTS "Isolamento por Tenant e Ambiente em lawyers" ON lawyers;

CREATE POLICY "Isolamento por Tenant e Ambiente em lawyers" ON lawyers
FOR ALL
USING (
    organization_id::TEXT = current_setting('custom.organization_id', true) AND
    environment = current_setting('app.current_env', true)
)
WITH CHECK (
    organization_id::TEXT = current_setting('custom.organization_id', true) AND
    environment = current_setting('app.current_env', true)
);

-- 5. ISOLAMENTO MULTI-TENANT E POR AMBIENTE NA TABELA PROCESSES
-- Adicionar coluna organization_id
ALTER TABLE processes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Adicionar coluna environment
ALTER TABLE processes ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production';

-- Atualizar políticas de RLS para a tabela processes (Isolamento duplo)
DROP POLICY IF EXISTS "Allow all for processes" ON processes;
DROP POLICY IF EXISTS "Isolamento por Tenant e Ambiente em processes" ON processes;

CREATE POLICY "Isolamento por Tenant e Ambiente em processes" ON processes
FOR ALL
USING (
    organization_id::TEXT = current_setting('custom.organization_id', true) AND
    environment = current_setting('app.current_env', true)
)
WITH CHECK (
    organization_id::TEXT = current_setting('custom.organization_id', true) AND
    environment = current_setting('app.current_env', true)
);

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload config';

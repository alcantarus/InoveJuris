-- Tabela de Tarefas (Tasks)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    rich_content JSONB,
    context_id UUID,
    ai_summary TEXT,
    due_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    priority INT DEFAULT 1 CHECK (priority BETWEEN 1 AND 3),
    rescheduled_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    environment TEXT DEFAULT 'production'
);


-- Tabela de Histórico de Tarefas (Audit)
CREATE TABLE IF NOT EXISTS task_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'rescheduled', 'completed')),
    previous_date DATE,
    new_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias tarefas" ON tasks;
CREATE POLICY "Usuários podem gerenciar suas próprias tarefas" ON tasks
FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Usuários podem ver histórico de suas tarefas" ON task_history;
CREATE POLICY "Usuários podem ver histórico de suas tarefas" ON task_history
FOR SELECT USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_history.task_id AND tasks.user_id = auth.uid()::text));

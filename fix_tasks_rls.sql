DROP POLICY IF EXISTS "Usuários podem gerenciar suas próprias tarefas" ON tasks;
DROP POLICY IF EXISTS "Usuários podem ver histórico de suas tarefas" ON task_history;

CREATE POLICY "Allow all access to tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to task_history" ON task_history FOR ALL USING (true) WITH CHECK (true);

-- Lote 08 — tarefas e Kanban

do $$
begin
  perform public._p0_drop_permissive(array[
    'tasks', 'task_history', 'kanban_boards', 'kanban_columns'
  ]);
  perform public._p0_apply_isolation(array[
    'tasks', 'task_history', 'kanban_boards', 'kanban_columns'
  ]);
end $$;

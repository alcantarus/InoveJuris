'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { CheckCircle, Circle, Loader2, Clock, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/Modal';

export default function TodayFocusWidget() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [completedColumnId, setCompletedColumnId] = useState<string | null>(null);
  const loadingRef = useRef(true);

  // Estados para edição
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDate, setEditTaskDate] = useState('');
  const [editTaskTime, setEditTaskTime] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  
  const fetchTasks = async () => {
    try {
      const storedUser = localStorage.getItem('inovejuris_user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      
      if (!currentUser) {
        setLoading(false);
        loadingRef.current = false;
        return;
      }
      
      // 1. Find the board ID
      let { data: boardData, error: boardError } = await supabase
        .from('kanban_boards')
        .select('id')
        .eq('module', 'agenda_inteligente')
        .limit(1)
        .single();
        
      if (boardError || !boardData) {
        // Create board if it doesn't exist
        const { data: newBoard, error: createError } = await supabase
          .from('kanban_boards')
          .insert({ name: 'Agenda Inteligente', module: 'agenda_inteligente', environment: 'production' })
          .select()
          .single();
        if (createError) throw createError;
        boardData = newBoard;
      }
      
      if (!boardData) return;

      // 2. Find the column IDs
      const { data: columnsData } = await supabase
        .from('kanban_columns')
        .select('id, title')
        .eq('board_id', boardData.id);
        
      if (!columnsData) return;

      let focusColumn = columnsData.find((c: any) => c.title === 'Meu Foco de Hoje');
      let completedColumn = columnsData.find((c: any) => c.title === 'Concluídos');

      // If focus column doesn't exist, we might need to create it (or wait for Kanban to do it)
      // But for the widget to work, it MUST exist.
      if (!focusColumn) {
        const { data: newCol, error: colError } = await supabase
          .from('kanban_columns')
          .insert({ 
            board_id: boardData.id, 
            title: "Meu Foco de Hoje", 
            position: 2, 
            color: '#3b82f6' 
          })
          .select()
          .single();
        if (!colError && newCol) {
          focusColumn = newCol;
        }
      }

      if (!completedColumn) {
        const { data: newCol, error: colError } = await supabase
          .from('kanban_columns')
          .insert({ 
            board_id: boardData.id, 
            title: "Concluídos", 
            position: 999, 
            color: '#94a3b8' 
          })
          .select()
          .single();
        if (!colError && newCol) {
          completedColumn = newCol;
        }
      }

      if (completedColumn) {
        setCompletedColumnId(completedColumn.id);
      }

      if (!focusColumn) return;

      // 3. Fetch tasks for that column
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', currentUser.id.toString())
        .eq('kanban_column_id', focusColumn.id)
        .order('priority', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        toast.error('Erro ao carregar tarefas de hoje.');
      } else {
        setTasks(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching tasks:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const completeTask = async (taskId: string) => {
    if (!completedColumnId) return;

    // Start animation
    setCompletingTasks(prev => new Set(prev).add(taskId));

    setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ kanban_column_id: completedColumnId })
          .eq('id', taskId);

        if (error) throw error;
        
        setTasks(prev => prev.filter(t => t.id !== taskId));
        toast.success('Tarefa concluída!');
      } catch (err) {
        console.error('Error completing task:', err);
        toast.error('Erro ao concluir tarefa.');
      } finally {
        setCompletingTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }
    }, 500);
  };

  const postponeTask = async (taskId: string) => {
    try {
      // 1. Find the board ID
      let { data: boardData, error: boardError } = await supabase
        .from('kanban_boards')
        .select('id')
        .eq('module', 'agenda_inteligente')
        .limit(1)
        .single();
        
      if (boardError || !boardData) {
        const { data: newBoard, error: createError } = await supabase
          .from('kanban_boards')
          .insert({ name: 'Agenda Inteligente', module: 'agenda_inteligente', environment: 'production' })
          .select()
          .single();
        if (createError) throw createError;
        boardData = newBoard;
      }
      
      if (!boardData) return;

      // 2. Find or create the "Compromissos Adiados" column
      let { data: columnData, error: colError } = await supabase
        .from('kanban_columns')
        .select('id')
        .eq('board_id', boardData.id)
        .eq('title', 'Compromissos Adiados')
        .limit(1)
        .single();
        
      if (colError || !columnData) {
        const { data: newCol, error: createColError } = await supabase
          .from('kanban_columns')
          .insert({ 
            board_id: boardData.id, 
            title: "Compromissos Adiados", 
            position: 1, 
            color: '#ef4444' 
          })
          .select()
          .single();
        if (createColError) throw createColError;
        columnData = newCol;
      }

      if (!columnData) return;

      const { error } = await supabase
        .from('tasks')
        .update({ kanban_column_id: columnData.id })
        .eq('id', taskId);

      if (error) throw error;
      toast.success('Tarefa adiada para Compromissos Adiados.');
      fetchTasks();
    } catch (err) {
      console.error('Error postponing task:', err);
      toast.error('Erro ao adiar tarefa.');
    }
  };

  const updateTask = async () => {
    if (!editingTaskId || !editTaskTitle) return;
    try {
      const priorityMap = { low: 1, medium: 2, high: 3 };
      const { error } = await supabase
        .from('tasks')
        .update({ 
          title: editTaskTitle, 
          priority: priorityMap[editTaskPriority],
          due_date: editTaskDate || null,
          scheduled_time: editTaskTime || null
        })
        .eq('id', editingTaskId);
      if (error) throw error;
      toast.success('Tarefa atualizada!');
      setIsEditTaskModalOpen(false);
      fetchTasks();
    } catch (err) {
      console.error('Error updating task:', err);
      toast.error('Erro ao atualizar tarefa.');
    }
  };

  if (loading) return <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900">Meu Foco de Hoje</h3>
        <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
          {tasks.length} pendentes
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhuma tarefa pendente para hoje.</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map(task => {
            const isCompleting = completingTasks.has(task.id);
            return (
              <li 
                key={task.id} 
                className={cn(
                  "flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-indigo-200 transition-all duration-200",
                  isCompleting ? "scale-95 grayscale opacity-50" : ""
                )}
              >
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => completeTask(task.id)}
                    className="text-slate-400 hover:text-emerald-500 transition-colors"
                  >
                    {isCompleting ? <CheckCircle className="text-emerald-500" /> : <Circle />}
                  </button>
                  <span className={cn(
                    "text-sm font-medium transition-all",
                    isCompleting ? "line-through text-slate-400" : "text-slate-900"
                  )}>
                    {task.title}
                  </span>
                </div>
                
                <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingTaskId(task.id);
                      setEditTaskTitle(task.title);
                      setEditTaskDate(task.due_date || '');
                      setEditTaskTime(task.scheduled_time || '');
                      setEditTaskPriority(task.priority === 3 ? 'high' : task.priority === 2 ? 'medium' : 'low');
                      setIsEditTaskModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                    title="Editar tarefa"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => postponeTask(task.id)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                    title="Adiar para amanhã/aguardando"
                  >
                    <Clock size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit Task Modal */}
      <Modal isOpen={isEditTaskModalOpen} onClose={() => setIsEditTaskModalOpen(false)} title="Editar Tarefa">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Título da Tarefa</label>
            <input 
              type="text" 
              value={editTaskTitle}
              onChange={(e) => setEditTaskTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="O que precisa ser feito?"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
              <input 
                type="date" 
                value={editTaskDate}
                onChange={(e) => setEditTaskDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Horário</label>
              <input 
                type="time" 
                value={editTaskTime}
                onChange={(e) => setEditTaskTime(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setEditTaskPriority(p)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition-all",
                    editTaskPriority === p 
                      ? p === 'high' ? "bg-rose-50 border-rose-500 text-rose-600" : p === 'medium' ? "bg-amber-50 border-amber-500 text-amber-600" : "bg-blue-50 border-blue-500 text-blue-600"
                      : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                  )}
                >
                  {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setIsEditTaskModalOpen(false)}
              className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={updateTask}
              className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

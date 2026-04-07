'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Loader2, Plus, MoreVertical, Edit2, Trash2, Check, X, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/Modal';
import { motion } from 'motion/react';

interface Task {
  id: string;
  title: string;
  kanban_column_id: string;
  kanban_order: number;
  user_id: string;
  priority: number; // 1: low, 2: medium, 3: high
  due_date: string | null;
  scheduled_time: string | null;
}

interface KanbanColumn {
  id: string;
  title: string;
  position: number;
  color: string;
}

function SortableColumn({ column, tasks, onAddTask, onRename, onDelete, onEditTask, onDeleteTask, onCompleteTask }: { 
  column: KanbanColumn, 
  tasks: Task[],
  onAddTask: (colId: string) => void,
  onRename: (id: string, title: string, color: string) => void,
  onDelete: (id: string) => void,
  onEditTask: (task: Task) => void,
  onDeleteTask: (taskId: string) => void,
  onCompleteTask: (taskId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div ref={setNodeRef} style={{ ...style, borderTop: `6px solid ${column.color}` }} className={cn(
      "flex-1 p-4 rounded-2xl border w-[280px] shrink-0 min-h-[400px] bg-white border-slate-200 shadow-sm group/column",
      isDragging ? "shadow-xl" : ""
    )}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    >
      <div {...attributes} {...listeners} className="flex justify-between items-center mb-4 cursor-grab">
        <h3 className="font-bold text-slate-900 truncate">{column.title}</h3>
        {column.position !== 1 && (
          <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover/column:opacity-100 transition-opacity" onPointerDown={(e) => e.stopPropagation()}>
            <button 
              onClick={() => onRename(column.id, column.title, column.color)}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Editar coluna"
            >
              <Edit2 size={14} />
            </button>
            <button 
              onClick={() => onDelete(column.id)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Excluir coluna"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {tasks.length === 0 && (
          <div className="p-4 border-2 border-dashed border-slate-100 rounded-xl text-center text-slate-400 text-sm">
            Sem ações aqui
          </div>
        )}
        <SortableContext items={tasks.map(t => t.id)}>
          {tasks.map(task => (
            <SortableTask key={task.id} task={task} onEdit={onEditTask} onDelete={onDeleteTask} onComplete={onCompleteTask} />
          ))}
        </SortableContext>
        <button 
          onClick={() => onAddTask(column.id)}
          className="w-full py-2 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Plus size={18} className="mr-1" /> Adicionar Ação
        </button>
      </div>
    </motion.div>
  );
}

function SortableTask({ task, onEdit, onDelete, onComplete }: { task: Task, onEdit: (t: Task) => void, onDelete: (id: string) => void, onComplete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const [isCompleting, setIsCompleting] = useState(false);
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : (isCompleting ? 0.3 : 1),
  };

  const formatDateTime = (dateStr: string | null, timeStr: string | null) => {
    let result = '';
    if (dateStr) {
      const [year, month, day] = dateStr.split('-');
      result += `${day}/${month}/${year}`;
    }
    if (timeStr) {
      if (result) result += ' às ';
      result += timeStr.substring(0, 5);
    }
    return result;
  };

  const dateTimeDisplay = formatDateTime(task.due_date, task.scheduled_time);

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCompleting(true);
    setTimeout(() => {
      onComplete(task.id);
    }, 500);
  };

  return (
    <motion.div ref={setNodeRef} style={style} {...attributes} {...listeners} className={cn(
      "p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 group/task relative",
      isDragging ? "rotate-2 shadow-xl" : "",
      task.priority === 3 ? "border-l-4 border-l-rose-500" : 
      task.priority === 2 ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-blue-500",
      isCompleting ? "scale-95 grayscale" : ""
    )}
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          <p className={cn("font-medium text-slate-800 text-sm transition-all", isCompleting ? "line-through text-slate-400" : "")}>{task.title}</p>
          {dateTimeDisplay && (
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <Clock size={12} /> {dateTimeDisplay}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover/task:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            className="p-1 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors"
            title="Editar tarefa"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Edit2 size={18} />
          </button>
          <button
            onClick={handleComplete}
            className="p-1 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-full transition-colors"
            title="Concluir tarefa"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <CheckCircle size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function TaskKanban() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [tempColor, setTempColor] = useState('');
  
  // Novos estados para adicionar tarefa
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Estados para editar tarefa
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDate, setEditTaskDate] = useState('');
  const [editTaskTime, setEditTaskTime] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [completedColumnId, setCompletedColumnId] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const fetchTasks = useCallback(async (bId: string) => {
    const storedUser = localStorage.getItem('inovejuris_user');
    const currentUser = storedUser ? JSON.parse(storedUser) : null;
    if (!currentUser) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', currentUser.id.toString());

    if (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Erro ao carregar tarefas.');
    } else {
      setTasks(data || []);
    }
  }, []);

  const fetchBoardAndColumns = useCallback(async () => {
    try {
      let { data: boardData, error: boardError } = await supabase
        .from('kanban_boards')
        .select('id')
        .eq('module', 'agenda_inteligente')
        .eq('organization_id', user?.organizationId)
        .limit(1)
        .single();

      if (boardError || !boardData) {
        const { data: newBoard, error: createError } = await supabase
          .from('kanban_boards')
          .insert({ name: 'Agenda Inteligente', module: 'agenda_inteligente', organization_id: user?.organizationId })
          .select()
          .single();
        if (createError) throw createError;
        boardData = newBoard;
      }

      if (!boardData) throw new Error('Failed to load or create kanban board');

      setBoardId(boardData.id);

      const { data: columnsData, error: columnsError } = await supabase
        .from('kanban_columns')
        .select('*')
        .eq('board_id', boardData.id)
        .eq('organization_id', user?.organizationId)
        .order('position', { ascending: true });

      if (columnsError) throw columnsError;
      
      let columns: KanbanColumn[] = columnsData || [];

      // Remove "Bloqueados por Terceiros (Aguardando)" if it exists
      const blockedCol = columns.find(c => c.title === "Bloqueados por Terceiros (Aguardando)");
      if (blockedCol) {
        await supabase.from('kanban_columns').delete().eq('id', blockedCol.id);
        columns = columns.filter(c => c.id !== blockedCol.id);
      }

      // If no columns exist (excluding Concluídos), add the default ones
      const activeColumns = columns.filter(c => c.title !== "Concluídos");
      if (activeColumns.length === 0) {
        const defaultTitles = ["Compromissos Adiados", "Meu Foco de Hoje", "Rotinas e Administrativo", "Próxima Semana"];
        for (let i = 0; i < defaultTitles.length; i++) {
          const title = defaultTitles[i];
          const { data: newCol, error: colError } = await supabase
            .from('kanban_columns')
            .insert({ 
              board_id: boardData.id, 
              title, 
              position: i + 1, 
              color: i === 0 ? '#ef4444' : i === 1 ? '#3b82f6' : i === 2 ? '#10b981' : '#8b5cf6',
              organization_id: user?.organizationId 
            })
            .select()
            .single();
          if (!colError && newCol) columns.push(newCol);
        }
      }

      // Ensure "Concluídos" column exists
      let completedCol = columns.find(c => c.title === "Concluídos");
      if (!completedCol) {
        const { data: newCol, error: colError } = await supabase
          .from('kanban_columns')
          .insert({ 
            board_id: boardData.id, 
            title: "Concluídos", 
            position: 999, 
            color: '#94a3b8',
            organization_id: user?.organizationId 
          })
          .select()
          .single();
        if (!colError && newCol) {
          completedCol = newCol;
          columns.push(newCol);
        }
      }
      if (completedCol) {
        setCompletedColumnId(completedCol.id);
      }
      
      setColumns(columns);
      
      fetchTasks(boardData.id);
    } catch (err) {
      console.error('Error fetching board/columns:', err);
      toast.error('Erro ao carregar colunas.');
    } finally {
      setLoading(false);
    }
  }, [fetchTasks]);

  useEffect(() => {
    if (user?.organizationId) {
      fetchBoardAndColumns();
    }
  }, [user?.organizationId, fetchBoardAndColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id;
    const overId = over.id;

    // Lógica para mover colunas
    if (columns.find(c => c.id === activeId)) {
      const oldIndex = columns.findIndex(c => c.id === activeId);
      const newIndex = columns.findIndex(c => c.id === overId);
      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);
      
      // Atualizar posições no banco
      for (let i = 0; i < newColumns.length; i++) {
        await supabase.from('kanban_columns').update({ position: i + 1 }).eq('id', newColumns[i].id);
      }
    } 
    // Lógica para mover tarefas
    else {
      const activeTask = tasks.find(t => t.id === activeId);
      const overTask = tasks.find(t => t.id === overId);
      const overColumn = columns.find(c => c.id === overId);
      
      if (!activeTask) return;

      const newColumnId = overTask ? overTask.kanban_column_id : (overColumn ? overColumn.id : activeTask.kanban_column_id);
      
      await supabase.from('tasks').update({ kanban_column_id: newColumnId }).eq('id', activeId);
      fetchTasks(boardId!);
    }
  };

  const addColumn = async (title: string) => {
    if (!boardId) return;
    try {
      const { error } = await supabase
        .from('kanban_columns')
        .insert({ board_id: boardId, title, position: columns.length + 1, color: '#6366f1' });
      if (error) throw error;
      fetchBoardAndColumns();
    } catch (err) {
      console.error('Error adding column:', err);
      toast.error('Erro ao adicionar coluna.');
    }
  };

  const renameColumn = async (id: string, title: string, color: string) => {
    const column = columns.find(c => c.id === id);
    // A primeira coluna (Compromissos Adiados) não pode ser renomeada
    if (column?.position === 1) {
      toast.error('A coluna "Compromissos Adiados" não pode ser alterada.');
      return;
    }
    try {
      const { error } = await supabase
        .from('kanban_columns')
        .update({ title, color })
        .eq('id', id);
      if (error) throw error;
      setEditingColumnId(null);
      fetchBoardAndColumns();
    } catch (err) {
      console.error('Error renaming column:', err);
      toast.error('Erro ao renomear coluna.');
    }
  };

  const deleteColumn = async (id: string) => {
    if (tasks.some(t => t.kanban_column_id === id)) {
      toast.error('Não é possível excluir coluna com tarefas.');
      return;
    }
    if (!confirm('Tem certeza que deseja excluir esta coluna?')) return;
    try {
      const { error } = await supabase
        .from('kanban_columns')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchBoardAndColumns();
    } catch (err) {
      console.error('Error deleting column:', err);
      toast.error('Erro ao excluir coluna.');
    }
  };

  const completeTask = async (id: string) => {
    if (!completedColumnId) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ kanban_column_id: completedColumnId })
        .eq('id', id);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === id ? { ...t, kanban_column_id: completedColumnId } : t));
      toast.success('Tarefa concluída!');
    } catch (err) {
      console.error('Error completing task:', err);
      toast.error('Erro ao concluir tarefa.');
    }
  };

  const addTask = async () => {
    if (!selectedColumnId || !newTaskTitle) return;
    const storedUser = localStorage.getItem('inovejuris_user');
    const currentUser = storedUser ? JSON.parse(storedUser) : null;
    if (!currentUser) return;

    try {
      const priorityMap = { low: 1, medium: 2, high: 3 };
      const { error } = await supabase
        .from('tasks')
        .insert({ 
          title: newTaskTitle, 
          kanban_column_id: selectedColumnId, 
          priority: priorityMap[newTaskPriority],
          due_date: newTaskDate || null,
          scheduled_time: newTaskTime || null,
          user_id: currentUser.id 
        });
      if (error) throw error;
      toast.success('Tarefa adicionada!');
      setIsAddTaskModalOpen(false);
      setNewTaskTitle('');
      setNewTaskDate('');
      setNewTaskTime('');
      if (boardId) fetchTasks(boardId);
    } catch (err) {
      console.error('Error adding task:', err);
      toast.error('Erro ao adicionar tarefa.');
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
      if (boardId) fetchTasks(boardId);
    } catch (err) {
      console.error('Error updating task:', err);
      toast.error('Erro ao atualizar tarefa.');
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
      toast.success('Tarefa excluída!');
      if (boardId) fetchTasks(boardId);
    } catch (err) {
      console.error('Error deleting task:', err);
      toast.error('Erro ao excluir tarefa.');
    }
  };

  useEffect(() => {
    const checkAlerts = () => {
      const now = new Date();
      tasks.forEach(task => {
        if (task.scheduled_time) {
          const [hours, minutes] = task.scheduled_time.split(':').map(Number);
          const taskTime = new Date();
          taskTime.setHours(hours, minutes, 0, 0);
          
          const diff = (taskTime.getTime() - now.getTime()) / (1000 * 60);
          
          if (diff > 0 && diff <= 15) {
            toast.warning(`Atenção: O compromisso "${task.title}" inicia em ${Math.round(diff)} minutos.`);
          }
        }
      });
    };

    const interval = setInterval(checkAlerts, 60000); // Verifica a cada minuto
    return () => clearInterval(interval);
  }, [tasks]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" /></div>;

  const activeColumns = columns.filter(c => c.id !== completedColumnId);
  const completedTasks = tasks.filter(t => t.kanban_column_id === completedColumnId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Fluxo de Compromissos</h2>
        <button 
          onClick={() => setIsHistoryModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <CheckCircle size={16} className="text-emerald-500" />
          Ver Histórico
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4">
          <SortableContext items={activeColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          {activeColumns.map(column => (
            <SortableColumn 
              key={column.id} 
              column={column} 
              tasks={tasks.filter(t => t.kanban_column_id === column.id)}
              onAddTask={(colId) => { setSelectedColumnId(colId); setIsAddTaskModalOpen(true); }}
              onRename={(id, title, color) => { setEditingColumnId(id); setTempTitle(title); setTempColor(color); }}
              onDelete={deleteColumn}
              onEditTask={(task) => {
                setEditingTaskId(task.id);
                setEditTaskTitle(task.title);
                setEditTaskDate(task.due_date || '');
                setEditTaskTime(task.scheduled_time || '');
                setEditTaskPriority(task.priority === 3 ? 'high' : task.priority === 2 ? 'medium' : 'low');
                setIsEditTaskModalOpen(true);
              }}
              onDeleteTask={deleteTask}
              onCompleteTask={completeTask}
            />
          ))}
          </SortableContext>
          <button 
            onClick={() => addColumn('Nova Coluna')}
            className="p-4 rounded-2xl border-2 border-dashed border-slate-300 w-[280px] shrink-0 flex flex-col items-center justify-center text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all duration-200 hover:bg-indigo-50"
          >
            <Plus size={24} className="mr-2" /> Adicionar Coluna
          </button>
        </div>
      </DndContext>

      <Modal isOpen={isAddTaskModalOpen} onClose={() => setIsAddTaskModalOpen(false)} title="Nova Ação">
        <div className="space-y-4">
          <input 
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="O que precisa ser feito?"
            className="w-full p-3 border rounded-xl"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input 
              type="date" 
              value={newTaskDate}
              onChange={(e) => setNewTaskDate(e.target.value)}
              className="w-full p-3 border rounded-xl" 
            />
            <input 
              type="time" 
              value={newTaskTime}
              onChange={(e) => setNewTaskTime(e.target.value)}
              className="w-full p-3 border rounded-xl"
            />
            <select 
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as any)}
              className="w-full p-3 border rounded-xl"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </div>
          <button onClick={addTask} className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700">
            Salvar Ação
          </button>
        </div>
      </Modal>

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

      {/* Edit Column Modal */}
      <Modal isOpen={!!editingColumnId} onClose={() => setEditingColumnId(null)} title="Editar Coluna">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Coluna</label>
            <input 
              type="text" 
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="Ex: Em Andamento"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cor</label>
            <div className="flex gap-2">
              {['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'].map(color => (
                <button
                  key={color}
                  onClick={() => setTempColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    tempColor === color ? "scale-125 ring-2 ring-offset-2 ring-slate-400" : "hover:scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setEditingColumnId(null)}
              className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={() => {
                if (editingColumnId && tempTitle) {
                  renameColumn(editingColumnId, tempTitle, tempColor);
                }
              }}
              className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title="Histórico de Concluídos">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {completedTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhuma tarefa concluída ainda.
            </div>
          ) : (
            completedTasks.map(task => (
              <div key={task.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <p className="font-medium text-slate-800 line-through opacity-70">{task.title}</p>
                  {(task.due_date || task.scheduled_time) && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Clock size={12} /> {task.due_date ? task.due_date.split('-').reverse().join('/') : ''} {task.scheduled_time ? `às ${task.scheduled_time.substring(0,5)}` : ''}
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => deleteTask(task.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Excluir permanentemente"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}

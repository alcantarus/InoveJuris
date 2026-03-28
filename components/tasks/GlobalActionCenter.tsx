'use client';

import { useState } from 'react';
import { Plus, Calendar as CalendarIcon, Flag, Loader2, Clock } from 'lucide-react';
import { Modal } from '../Modal';
import TaskEditor from './TaskEditor';
import TaskIntelligence from './TaskIntelligence';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { getAppEnv } from '@/lib/env';

export default function GlobalActionCenter() {
  const { user, loading: authLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!title) {
      toast.error('Por favor, insira um título.');
      return;
    }

    if (authLoading) {
      toast.error('Aguarde, carregando informações do usuário...');
      return;
    }
    
    const storedUser = localStorage.getItem('inovejuris_user');
    const currentUser = user || (storedUser ? JSON.parse(storedUser) : null);

    if (!currentUser) {
      toast.error('Você precisa estar logado para criar tarefas.');
      return;
    }
    
    console.log('User ID para salvar tarefa:', currentUser.id);

    const taskData = {
      title,
      description: content,
      due_date: dueDate,
      scheduled_time: dueTime || null,
      priority: Number(priority),
      status: 'pending',
      user_id: currentUser.id.toString(), // Garantir que seja string para o banco
      environment: getAppEnv(),
      kanban_column_id: null // Placeholder, will be updated below
    };
    
    console.log('Saving task with data:', JSON.stringify(taskData, null, 2));

    setLoading(true);
    try {
      // 1. Find the column ID for 'Meu Foco de Hoje'
      const { data: boardData } = await supabase
        .from('kanban_boards')
        .select('id')
        .eq('module', 'agenda_inteligente')
        .limit(1)
        .single();
        
      if (boardData) {
        const { data: columnData } = await supabase
          .from('kanban_columns')
          .select('id')
          .eq('board_id', boardData.id)
          .eq('title', 'Meu Foco de Hoje')
          .single();
        if (columnData) taskData.kanban_column_id = columnData.id;
      }

      const { error } = await supabase
        .from('tasks')
        .insert(taskData);

      if (error) {
        console.error('Error saving task:', JSON.stringify(error, null, 2));
        toast.error(`Erro ao salvar tarefa: ${error.message}`);
      } else {
        toast.success('Compromisso criado com sucesso!');
        setIsOpen(false);
        setTitle('');
        setContent('');
        setDueDate(new Date().toISOString().split('T')[0]);
        setDueTime('');
        setPriority(1);
        // Refresh page to update widgets
        window.location.reload();
      }
    } catch (err) {
      console.error('Unexpected error saving task:', err);
      toast.error('Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all z-50 group"
        title="Novo Compromisso"
      >
        <Plus size={24} className="group-hover:rotate-90 transition-transform" />
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Novo Compromisso">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Reunião com Cliente, Preparar Petição..."
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <CalendarIcon size={14} /> Data
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Clock size={14} /> Horário
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Flag size={14} /> Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10))}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value={1}>Baixa</option>
                <option value={2}>Média</option>
                <option value={3}>Alta</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Descrição</label>
              <TaskIntelligence taskTitle={title} onAddSubtasks={(subtasks) => {
                setContent(prev => prev + `<p><strong>Sub-tarefas sugeridas:</strong></p><ul>${subtasks.map(s => `<li>${s}</li>`).join('')}</ul>`);
              }} />
            </div>
            <TaskEditor content={content} onChange={setContent} />
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            Criar Compromisso
          </button>
        </div>
      </Modal>
    </>
  );
}

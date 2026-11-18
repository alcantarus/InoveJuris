'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TaskIntelligenceProps {
  taskTitle: string;
  onAddSubtasks: (subtasks: string[]) => void;
}

export default function TaskIntelligence({ taskTitle, onAddSubtasks }: TaskIntelligenceProps) {
  const [loading, setLoading] = useState(false);

  const generateSubtasks = async () => {
    if (!taskTitle) {
      toast.error('Por favor, insira um título para a tarefa primeiro.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'task_subtasks',
          payload: { title: taskTitle },
        }),
      });

      if (!response.ok) throw new Error('Falha ao gerar sub-tarefas');
      const result = await response.json();
      const json = JSON.parse(result.text || '{}');
      if (json.subtasks) {
        onAddSubtasks(json.subtasks);
        toast.success('Sub-tarefas sugeridas com sucesso!');
      }
    } catch (error) {
      console.error('Error generating subtasks:', error);
      toast.error('Erro ao gerar sub-tarefas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={generateSubtasks}
      disabled={loading}
      className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
      Sugerir sub-tarefas com IA
    </button>
  );
}

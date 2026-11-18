'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Loader2, Sparkles, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function AIInsightsWidget() {
  const { user } = useAuth();
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const generateInsight = async () => {
      try {
        const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !supabaseUser) {
          if (isMounted) setLoading(false);
          return;
        }

        interface TaskItem {
          title: string;
          status: string;
          due_date: string | null;
          priority: number;
          created_at: string;
        }

        // Fetch tasks
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('title, status, due_date, priority, created_at')
          .eq('user_id', supabaseUser.id);

        if (!isMounted) return;

        if (error || !tasks || tasks.length === 0) {
          setInsight('Não há dados suficientes para gerar insights no momento. Adicione mais tarefas!');
          setLoading(false);
          return;
        }

        // Envia apenas numeros agregados; a chave fica no servidor.
        const pendingTasks = (tasks as TaskItem[]).filter(t => t.status === 'pending').length;
        const completedTasks = (tasks as TaskItem[]).filter(t => t.status === 'completed').length;
        const highPriorityPending = (tasks as TaskItem[]).filter(t => t.status === 'pending' && t.priority > 1).length;

        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'dashboard_insight',
            payload: {
              total: tasks.length,
              completed: completedTasks,
              pending: pendingTasks,
              highPriorityPending,
            },
          }),
        });

        if (!response.ok) throw new Error('Falha ao gerar insight');
        const result = await response.json();

        if (isMounted) {
          setInsight(result.text || 'Não foi possível gerar um insight no momento.');
        }
      } catch (err: any) {
        console.error('Error generating AI insight:', err);
        if (isMounted) {
          setInsight('Ocorreu um erro ao gerar o insight. Tente novamente mais tarde.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    generateInsight();
    return () => { isMounted = false; };
  }, [user]);

  if (loading) {
    return (
      <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl border border-indigo-100 shadow-sm flex items-center justify-center min-h-[150px]">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl border border-indigo-100 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <BrainCircuit size={120} />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
            <Sparkles size={20} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Insight de Produtividade</h3>
        </div>
        
        <div className="text-slate-700 leading-relaxed text-sm prose prose-sm max-w-none">
          <ReactMarkdown>{insight || ''}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

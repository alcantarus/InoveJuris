'use client';

import { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
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

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      toast.error('A chave da API Gemini não está configurada.');
      return;
    }

    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Sugira 3 a 5 sub-tarefas práticas para o compromisso: "${taskTitle}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subtasks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Lista de sub-tarefas sugeridas.',
              },
            },
            required: ['subtasks'],
          },
        },
      });

      const json = JSON.parse(response.text || '{}');
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

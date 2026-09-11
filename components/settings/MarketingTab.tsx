'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Edit2, Save, X, Image as ImageIcon, Type, AlertCircle, CheckCircle2, Sparkles, Upload, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { analyzeTemplateImage } from '@/lib/actions/gemini';

interface BirthdayTemplate {
  id: string;
  name: string;
  image_url: string;
  text_color: string;
  name_y: string;
  name_x: string;
  name_size: string;
  name_max_width: string;
  name_font?: string;
  msg_y: string;
  msg_x: string;
  msg_size: string;
  msg_max_width: string;
  msg_font?: string;
  line_height: string;
  text_align: 'left' | 'center' | 'right';
  is_active: boolean;
}

interface BirthdayMessage {
  id: string;
  content: string;
  is_active: boolean;
}

export function MarketingTab() {
  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'messages'>('templates');
  const [templates, setTemplates] = useState<BirthdayTemplate[]>([]);
  const [messages, setMessages] = useState<BirthdayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  // ... (rest of the component logic)
  const [editingTemplate, setEditingTemplate] = useState<Partial<BirthdayTemplate> | null>(null);
  const [editingMessage, setEditingMessage] = useState<Partial<BirthdayMessage> | null>(null);

  useEffect(() => {
    fetchData();
    const savedKey = localStorage.getItem('gemini_manual_key');
    if (savedKey) setManualKey(savedKey);
  }, []);

  const saveManualKey = (key: string) => {
    setManualKey(key);
    localStorage.setItem('gemini_manual_key', key);
    toast.success('Chave salva localmente!');
  };

  const fetchData = async () => {
    setIsLoading(true);
    setDbError(false);
    try {
      // Use supabase directly (proxy handles environment)
      const client = supabase;
      
      const [templatesRes, messagesRes] = await Promise.all([
        client.from('birthday_templates').select('*').order('created_at', { ascending: false }),
        client.from('birthday_messages').select('*').order('created_at', { ascending: false })
      ]);

      if (templatesRes.error) console.error('Templates Error:', templatesRes.error);
      if (messagesRes.error) console.error('Messages Error:', messagesRes.error);

      if (templatesRes.error || messagesRes.error) {
        setDbError(true);
        setErrorMessage(
          (templatesRes.error?.message || '') + 
          (messagesRes.error ? (templatesRes.error ? ' | ' : '') + messagesRes.error.message : '')
        );
      } else {
        setTemplates(templatesRes.data || []);
        setMessages(messagesRes.data || []);
        if (messagesRes.data && messagesRes.data.length > 0) {
          console.log('Mensagens carregadas:', messagesRes.data.length);
        }
      }
    } catch (error) {
      console.error('MarketingTab Catch Error:', error);
      setDbError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `templates/${fileName}`;

      // Upload to Supabase Storage (Bucket 'marketing')
      // Note: Bucket must be created in Supabase Dashboard with public access
      const { data, error } = await supabase.storage
        .from('marketing')
        .upload(filePath, file);

      if (error) {
        if (error.message.includes('bucket not found')) {
          toast.error('Bucket "marketing" não encontrado no Supabase. Crie-o no painel do Supabase Storage.');
        } else {
          throw error;
        }
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('marketing')
        .getPublicUrl(filePath);

      setEditingTemplate(prev => ({ ...prev, image_url: publicUrl }));
      toast.success('Imagem carregada com sucesso!');
      
      // Auto-analyze with AI after upload
      await analyzeImage(publicUrl);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao carregar imagem: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const analyzeImage = async (imageUrl: string) => {
    setIsAnalyzing(true);
    try {
      const base64Data = await fetchAndResizeImage(imageUrl);
      const result = await analyzeTemplateImage(base64Data, manualKey);
      
      if (result.error) {
        throw new Error(result.error);
      }

      const analysis = result.data;
      
      setEditingTemplate(prev => ({
        ...prev,
        name_x: analysis.name_x,
        name_y: analysis.name_y,
        name_size: analysis.name_size || prev?.name_size,
        name_max_width: analysis.max_width || prev?.name_max_width || '80%',
        msg_x: analysis.msg_x,
        msg_y: analysis.msg_y,
        msg_size: analysis.msg_size || prev?.msg_size,
        msg_max_width: analysis.max_width || prev?.msg_max_width || '80%',
        line_height: analysis.line_height || prev?.line_height || '1.2',
        text_color: analysis.text_color,
        text_align: analysis.text_align
      }));
      toast.success('IA analisou o layout e sugeriu as melhores posições!');
    } catch (error: any) {
      console.error('AI Analysis error:', error);
      toast.error(error.message || 'IA não conseguiu analisar a imagem, mas você pode ajustar manualmente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchAndResizeImage = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to low quality JPEG to keep payload small
        const base64String = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        resolve(base64String);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  };

  const handleMove = (field: 'name' | 'msg', direction: 'up' | 'down' | 'left' | 'right') => {
    if (!editingTemplate) return;
    
    const xField = field === 'name' ? 'name_x' : 'msg_x';
    const yField = field === 'name' ? 'name_y' : 'msg_y';
    
    let currentX = parseFloat((editingTemplate[xField] || '50').replace('%', ''));
    let currentY = parseFloat((editingTemplate[yField] || '50').replace('%', ''));
    
    const step = 1; // 1% step
    
    if (direction === 'left') currentX -= step;
    if (direction === 'right') currentX += step;
    if (direction === 'up') currentY -= step;
    if (direction === 'down') currentY += step;
    
    setEditingTemplate({
      ...editingTemplate,
      [xField]: `${currentX}%`,
      [yField]: `${currentY}%`
    });
  };

  const adjustFontSize = (field: 'name_size' | 'msg_size', delta: number) => {
    if (!editingTemplate) return;
    const currentSize = parseInt(editingTemplate[field] || '16px');
    const newSize = Math.max(8, currentSize + delta) + 'px';
    setEditingTemplate({ ...editingTemplate, [field]: newSize });
  };

  const saveTemplate = async () => {
    if (!editingTemplate?.name || !editingTemplate?.image_url) {
      toast.error('Nome e URL da imagem são obrigatórios.');
      return;
    }

    try {
      const payload = {
        name: editingTemplate.name,
        image_url: editingTemplate.image_url,
        text_color: editingTemplate.text_color || '#ffffff',
        name_y: editingTemplate.name_y || '40%',
        name_x: editingTemplate.name_x || '50%',
        name_size: editingTemplate.name_size || '36px',
        name_max_width: editingTemplate.name_max_width || '80%',
        name_font: editingTemplate.name_font || 'serif',
        msg_y: editingTemplate.msg_y || '60%',
        msg_x: editingTemplate.msg_x || '50%',
        msg_size: editingTemplate.msg_size || '14px',
        msg_max_width: editingTemplate.msg_max_width || '80%',
        msg_font: editingTemplate.msg_font || 'sans-serif',
        line_height: editingTemplate.line_height || '1.2',
        text_align: editingTemplate.text_align || 'center',
        is_active: editingTemplate.is_active !== false
      };

      if (editingTemplate.id) {
        const { error } = await supabase.from('birthday_templates').update(payload).eq('id', editingTemplate.id);
        if (error) throw error;
        toast.success('Template atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('birthday_templates').insert([payload]);
        if (error) throw error;
        toast.success('Template criado com sucesso!');
      }
      setEditingTemplate(null);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao salvar template: ' + error.message);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;
    try {
      const { error } = await supabase.from('birthday_templates').delete().eq('id', id);
      if (error) throw error;
      toast.success('Template excluído!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const saveMessage = async () => {
    if (!editingMessage?.content) {
      toast.error('O conteúdo da mensagem é obrigatório.');
      return;
    }

    try {
      const payload = {
        content: editingMessage.content,
        is_active: editingMessage.is_active !== false
      };

      if (editingMessage.id) {
        const { error } = await supabase.from('birthday_messages').update(payload).eq('id', editingMessage.id);
        if (error) throw error;
        toast.success('Mensagem atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('birthday_messages').insert([payload]);
        if (error) throw error;
        toast.success('Mensagem criada com sucesso!');
      }
      setEditingMessage(null);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao salvar mensagem: ' + error.message);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta mensagem?')) return;
    try {
      const { error } = await supabase.from('birthday_messages').delete().eq('id', id);
      if (error) throw error;
      toast.success('Mensagem excluída!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const seedMessages = async () => {
    if (!confirm('Isso adicionará várias mensagens padrão ao sistema. Deseja continuar?')) return;
    
    setIsLoading(true);
    try {
      const DEFAULT_MESSAGES = [
        "Neste dia especial, celebramos a sua vida e a honra de tê-lo(a) como cliente. Que este novo ciclo traga muita paz, saúde e vitórias em todos os seus caminhos.",
        "Feliz aniversário! Agradecemos a confiança depositada em nosso trabalho. Que seu novo ano de vida seja marcado por grandes conquistas e muita prosperidade.",
        "Hoje o dia é todo seu! Nossa equipe lhe deseja um feliz aniversário. Que a justiça, a paz e a alegria sejam constantes em sua jornada.",
        "Um brinde a você! Que a vida continue lhe presenteando com momentos inesquecíveis. Receba o abraço afetuoso de toda a nossa equipe neste dia tão especial.",
        "Hoje celebramos a sua vida! Que este novo ciclo seja de muita paz, saúde e justiça. É uma honra tê-lo(a) conosco.",
        "Feliz aniversário! Desejamos que seu caminho seja sempre iluminado e repleto de vitórias. Um abraço de toda a nossa equipe.",
        "Parabéns pelo seu dia! Que a felicidade seja constante e que possamos continuar trilhando juntos um caminho de sucesso.",
        "Nossos mais sinceros votos de felicidades! Que a vida lhe reserve grandes surpresas e muitas realizações neste novo ano.",
        "Celebrar o seu aniversário é celebrar uma parceria de confiança. Desejamos muita saúde, prosperidade e paz.",
        "Mais um ano de vida, mais um ano de conquistas! Que seus direitos sejam sempre preservados e seus sonhos realizados.",
        "Feliz aniversário! É um privilégio atuar na defesa dos seus interesses. Que a vida lhe retribua com muita alegria e tranquilidade.",
        "Parabéns! Que a sabedoria e a serenidade guiem seus passos neste novo ciclo. Felicidades de toda a nossa equipe jurídica.",
        "Um brinde à sua vida! Que a prosperidade e a justiça caminhem lado a lado com você todos os dias. Feliz aniversário!",
        "Nossa equipe se alegra com o seu dia. Que a sua jornada seja sempre pautada por grandes vitórias, segurança e paz.",
        "Hoje o dia amanheceu mais feliz. Receba nosso abraço e nossos votos de um ano extraordinário, repleto de saúde e sucesso.",
        "Desejamos que este novo capítulo da sua história seja escrito com tintas de alegria, saúde e muita paz. Parabéns!",
        "Feliz aniversário! Que a vida continue lhe presenteando com momentos inesquecíveis ao lado de quem você ama.",
        "Receba nossas homenagens neste dia tão especial. Que a saúde, o amor e a paz sejam suas companheiras diárias.",
        "Celebrar você é celebrar a confiança que nos une. Desejamos um aniversário maravilhoso e um ano de realizações plenas.",
        "Parabéns! Que o sucesso seja o destino inevitável de todos os seus projetos neste novo ano de vida. Felicidades!",
        "Parabéns pelo seu dia! Que a paz interior e a força para vencer transbordem em sua vida hoje e sempre.",
        "Nossos melhores votos para você! Que este novo ciclo traga renovação, força e muitas alegrias inesperadas.",
        "Feliz aniversário! Que cada novo dia seja uma oportunidade para grandes conquistas. Um abraço afetuoso de nossa equipe.",
        "Que a alegria deste dia se estenda por todos os meses do seu ano. Feliz aniversário, com os melhores cumprimentos do nosso escritório.",
        "Prezado(a) cliente, neste dia especial, renovamos nossos votos de estima e consideração. Que seu aniversário seja o início de um ano repleto de realizações pessoais e profissionais.",
        "A vida é um presente, e hoje celebramos a sua! Que a justiça e a felicidade sejam constantes em sua caminhada. Feliz aniversário!",
        "Com gratidão e respeito, desejamos um feliz aniversário! Que a saúde e a paz sejam suas aliadas em todos os momentos.",
        "Parabéns! Que a luz da sabedoria ilumine seus dias e que a justiça prevaleça em todos os seus pleitos. Felicidades!",
        "Hoje é dia de celebrar você! Agradecemos por nos permitir fazer parte da sua história. Um feliz e abençoado aniversário."
      ];

      const messagesToInsert = DEFAULT_MESSAGES.map(content => ({
        content,
        is_active: true
      }));
      
      const { error } = await supabase.from('birthday_messages').insert(messagesToInsert);
      
      if (error) throw error;
      
      toast.success(`${messagesToInsert.length} mensagens adicionadas com sucesso!`);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao adicionar mensagens: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Carregando configurações...</div>;
  }

  if (dbError) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center gap-3 text-amber-600 mb-4">
          <AlertCircle className="w-6 h-6" />
          <h2 className="text-lg font-semibold">Tabelas não encontradas no Banco de Dados</h2>
        </div>
        {errorMessage && (
          <div className="bg-red-50 text-red-700 p-3 rounded mb-4 border border-red-200 text-sm font-mono">
            Erro: {errorMessage}
          </div>
        )}
        <p className="text-slate-600 mb-4">
          Para utilizar o sistema de Marketing dinâmico, você precisa criar as tabelas no Supabase.
          Acesse o <strong>SQL Editor</strong> no seu painel do Supabase e execute o seguinte código:
        </p>
        <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
{`-- Habilitar extensão para UUID se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de Templates de Cartão
CREATE TABLE IF NOT EXISTS birthday_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  text_color TEXT DEFAULT '#ffffff',
  name_y TEXT DEFAULT '40%',
  name_x TEXT DEFAULT '50%',
  name_size TEXT DEFAULT '36px',
  name_max_width TEXT DEFAULT '80%',
  msg_y TEXT DEFAULT '60%',
  msg_x TEXT DEFAULT '50%',
  msg_size TEXT DEFAULT '14px',
  msg_max_width TEXT DEFAULT '80%',
  line_height TEXT DEFAULT '1.2',
  text_align TEXT DEFAULT 'center',
  is_active BOOLEAN DEFAULT true,
  environment TEXT DEFAULT 'production',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Mensagens de Aniversário
CREATE TABLE IF NOT EXISTS birthday_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  environment TEXT DEFAULT 'production',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Logs de Marketing (Rastreabilidade)
CREATE TABLE IF NOT EXISTS marketing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  template_id UUID,
  type TEXT DEFAULT 'birthday_card',
  environment TEXT DEFAULT 'production',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`}
        </pre>
        <div className="flex gap-3">
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }



  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="border-b border-slate-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveSubTab('templates')}
            className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
              activeSubTab === 'templates'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ImageIcon className="w-5 h-5 inline-block mr-2" />
            Templates de Cartão (Artes)
          </button>
          <button
            onClick={() => setActiveSubTab('messages')}
            className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
              activeSubTab === 'messages'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Type className="w-5 h-5 inline-block mr-2" />
            Mensagens de Aniversário
          </button>
        </nav>
      </div>

      <div className="p-6">
        {activeSubTab === 'templates' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-slate-900">Artes de Fundo</h3>
                <p className="text-sm text-slate-500">Configure as imagens e a posição dos textos para os cartões.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className="flex items-center gap-2 px-3 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  Configurar IA
                </button>
                <button
                  onClick={() => setEditingTemplate({})}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Nova Arte
                </button>
              </div>
            </div>

            {showKeyInput && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Configuração Manual da IA
                </div>
                <p className="text-xs text-amber-700">
                  Se a IA não estiver funcionando, cole sua chave do Google AI Studio abaixo. 
                  Ela será salva apenas no seu navegador.
                </p>
                <div className="flex gap-2">
                  <input 
                    type="password"
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    placeholder="Cole sua chave AIza... aqui"
                    className="flex-1 text-sm border-amber-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  />
                  <button 
                    onClick={() => saveManualKey(manualKey)}
                    className="px-4 py-2 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700 font-medium"
                  >
                    Salvar Chave
                  </button>
                </div>
              </div>
            )}

            {editingTemplate !== null ? (
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                <h4 className="font-medium text-slate-900 mb-4">
                  {editingTemplate.id ? 'Editar Arte' : 'Nova Arte'}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Arte</label>
                      <input 
                        type="text" 
                        value={editingTemplate.name || ''}
                        onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                        className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Ex: Fundo Escuro Elegante"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Upload da Imagem</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            value={editingTemplate.image_url || ''}
                            onChange={e => setEditingTemplate({...editingTemplate, image_url: e.target.value})}
                            className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="https://..."
                          />
                        </div>
                        <label className="cursor-pointer flex items-center justify-center px-3 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors">
                          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-slate-500" />}
                          <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cor do Texto</label>
                        <div className="flex gap-2">
                          <input 
                            type="color"
                            value={editingTemplate.text_color || '#ffffff'}
                            onChange={e => setEditingTemplate({...editingTemplate, text_color: e.target.value})}
                            className="h-9 w-12 p-1 border border-slate-300 rounded-md"
                          />
                          <input 
                            type="text" 
                            value={editingTemplate.text_color || '#ffffff'}
                            onChange={e => setEditingTemplate({...editingTemplate, text_color: e.target.value})}
                            className="flex-1 border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Alinhamento</label>
                        <select 
                          value={editingTemplate.text_align || 'center'}
                          onChange={e => setEditingTemplate({...editingTemplate, text_align: e.target.value as any})}
                          className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        >
                          <option value="left">Esquerda</option>
                          <option value="center">Centro</option>
                          <option value="right">Direita</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fonte do Nome</label>
                        <select 
                          value={editingTemplate.name_font || 'serif'}
                          onChange={e => setEditingTemplate({...editingTemplate, name_font: e.target.value})}
                          className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        >
                          <option value="serif">Serif (Clássica)</option>
                          <option value="sans-serif">Sans-Serif (Moderna)</option>
                          <option value="cursive">Cursive (Escrita)</option>
                          <option value="monospace">Monospace (Técnica)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fonte da Mensagem</label>
                        <select 
                          value={editingTemplate.msg_font || 'sans-serif'}
                          onChange={e => setEditingTemplate({...editingTemplate, msg_font: e.target.value})}
                          className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        >
                          <option value="serif">Serif (Clássica)</option>
                          <option value="sans-serif">Sans-Serif (Moderna)</option>
                          <option value="cursive">Cursive (Escrita)</option>
                          <option value="monospace">Monospace (Técnica)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Preview
                    </label>
                    <div 
                      className="relative aspect-square rounded-lg overflow-hidden border-2 border-slate-200 transition-all"
                    >
                      {editingTemplate.image_url ? (
                        <>
                          <Image 
                            src={editingTemplate.image_url} 
                            alt="Preview" 
                            fill 
                            className="object-cover" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 pointer-events-none">
                            <div 
                              className="absolute transition-all duration-300"
                              style={{
                                top: editingTemplate.name_y || '40%', 
                                left: editingTemplate.name_x || '50%', 
                                transform: editingTemplate.text_align === 'center' ? 'translate(-50%, -50%)' : editingTemplate.text_align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
                                color: editingTemplate.text_color || '#ffffff', 
                                fontSize: editingTemplate.name_size || '24px', 
                                textAlign: editingTemplate.text_align || 'center', 
                                width: 'fit-content',
                                maxWidth: editingTemplate.name_max_width || '80%',
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                lineHeight: '1.1'
                              }}
                            >
                              <span className="font-serif font-bold uppercase tracking-tight leading-none block">NOME CLIENTE</span>
                            </div>
                            <div 
                              className="absolute transition-all duration-300"
                              style={{
                                top: editingTemplate.msg_y || '60%', 
                                left: editingTemplate.msg_x || '50%', 
                                transform: editingTemplate.text_align === 'center' ? 'translate(-50%, -50%)' : editingTemplate.text_align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
                                color: editingTemplate.text_color || '#ffffff', 
                                fontSize: editingTemplate.msg_size || '14px', 
                                textAlign: editingTemplate.text_align || 'center', 
                                width: 'fit-content',
                                maxWidth: editingTemplate.msg_max_width || '80%',
                                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                lineHeight: editingTemplate.line_height || '1.4'
                              }}
                            >
                              <span className="font-sans font-medium">Sua mensagem de aniversário aparecerá aqui...</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon className="w-12 h-12 mb-2" />
                          <p className="text-xs">Faça upload para ver o preview</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-200">
                  {/* CONFIGURAÇÃO DO NOME */}
                  <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <h5 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 mb-3">Configuração do Nome</h5>
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">Tamanho</span>
                      <div className="flex gap-1">
                        <button onClick={() => adjustFontSize('name_size', -2)} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600">-</button>
                        <span className="px-3 py-1 bg-slate-100 rounded text-xs font-mono min-w-[3rem] text-center">{editingTemplate.name_size || '24px'}</span>
                        <button onClick={() => adjustFontSize('name_size', 2)} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600">+</button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Posição</span>
                        <div className="grid grid-cols-3 gap-1 w-24">
                          <div />
                          <button onClick={() => handleMove('name', 'up')} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 flex justify-center"><ChevronUp size={14} /></button>
                          <div />
                          <button onClick={() => handleMove('name', 'left')} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 flex justify-center"><ChevronLeft size={14} /></button>
                          <div className="w-full h-full bg-slate-100 rounded-full" />
                          <button onClick={() => handleMove('name', 'right')} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 flex justify-center"><ChevronRight size={14} /></button>
                          <div />
                          <button onClick={() => handleMove('name', 'down')} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 flex justify-center"><ChevronDown size={14} /></button>
                          <div />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CONFIGURAÇÃO DA MENSAGEM */}
                  <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <h5 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 mb-3">Configuração da Mensagem</h5>
                    
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">Tamanho</span>
                      <div className="flex gap-1">
                        <button onClick={() => adjustFontSize('msg_size', -2)} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600">-</button>
                        <span className="px-3 py-1 bg-slate-100 rounded text-xs font-mono min-w-[3rem] text-center">{editingTemplate.msg_size || '14px'}</span>
                        <button onClick={() => adjustFontSize('msg_size', 2)} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600">+</button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">Largura Máx.</span>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingTemplate({...editingTemplate, msg_max_width: (parseInt(editingTemplate.msg_max_width || '80') - 5) + '%'})} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600">-</button>
                        <span className="px-3 py-1 bg-slate-100 rounded text-xs font-mono min-w-[3rem] text-center">{editingTemplate.msg_max_width || '80%'}</span>
                        <button onClick={() => setEditingTemplate({...editingTemplate, msg_max_width: (parseInt(editingTemplate.msg_max_width || '80') + 5) + '%'})} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600">+</button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Posição</span>
                        <div className="grid grid-cols-3 gap-1 w-24">
                          <div />
                          <button onClick={() => handleMove('msg', 'up')} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 flex justify-center"><ChevronUp size={14} /></button>
                          <div />
                          <button onClick={() => handleMove('msg', 'left')} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 flex justify-center"><ChevronLeft size={14} /></button>
                          <div className="w-full h-full bg-slate-100 rounded-full" />
                          <button onClick={() => handleMove('msg', 'right')} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 flex justify-center"><ChevronRight size={14} /></button>
                          <div />
                          <button onClick={() => handleMove('msg', 'down')} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 flex justify-center"><ChevronDown size={14} /></button>
                          <div />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center py-2">
                  <button
                    onClick={() => editingTemplate.image_url && analyzeImage(editingTemplate.image_url)}
                    disabled={isAnalyzing || !editingTemplate.image_url}
                    className="flex items-center gap-2 px-6 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-full hover:bg-amber-100 transition-all text-sm font-bold disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> IA Analisando...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Tentar Sugestão da IA</>
                    )}
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    onClick={() => setEditingTemplate(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={saveTemplate}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Arte
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    Nenhuma arte cadastrada. Clique em &quot;Nova Arte&quot; para começar.
                  </div>
                ) : (
                  templates.map(template => (
                    <div key={template.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="aspect-square relative bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={template.image_url} alt={template.name} className="w-full h-full object-cover" />
                        
                        {/* Preview overlay */}
                        <div className="absolute inset-0 pointer-events-none">

                          <div 
                            className="absolute"
                            style={{
                              top: template.name_y, 
                              left: template.name_x, 
                              transform: template.text_align === 'center' ? 'translate(-50%, -50%)' : template.text_align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
                              color: template.text_color, 
                              fontSize: template.name_size, 
                              textAlign: template.text_align, 
                              width: 'fit-content',
                              maxWidth: template.name_max_width || '80%',
                              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                              lineHeight: '1.1'
                            }}
                          >
                            <span className="font-serif font-bold uppercase tracking-tight leading-none block">NOME</span>
                          </div>
                          <div 
                            className="absolute"
                            style={{
                              top: template.msg_y, 
                              left: template.msg_x, 
                              transform: template.text_align === 'center' ? 'translate(-50%, -50%)' : template.text_align === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
                              color: template.text_color, 
                              fontSize: template.msg_size, 
                              textAlign: template.text_align, 
                              width: 'fit-content',
                              maxWidth: template.msg_max_width || '70%',
                              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                              lineHeight: template.line_height || '1.4'
                            }}
                          >
                            <span className="font-sans font-medium">Mensagem de aniversário...</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-slate-900 truncate">{template.name}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${template.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                            {template.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingTemplate(template)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteTemplate(template.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'messages' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-slate-900">Mensagens de Aniversário</h3>
                <p className="text-sm text-slate-500">Cadastre os textos que poderão ser escolhidos na hora de gerar o cartão.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={seedMessages}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  Gerar Mensagens Padrão
                </button>
                <button
                  onClick={() => setEditingMessage({})}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Nova Mensagem
                </button>
              </div>
            </div>

            {editingMessage !== null ? (
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                <h4 className="font-medium text-slate-900 mb-4">
                  {editingMessage.id ? 'Editar Mensagem' : 'Nova Mensagem'}
                </h4>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Conteúdo da Mensagem</label>
                  <textarea 
                    value={editingMessage.content || ''}
                    onChange={e => setEditingMessage({...editingMessage, content: e.target.value})}
                    rows={4}
                    className="w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Digite a mensagem de felicitação..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    onClick={() => setEditingMessage(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={saveMessage}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Mensagem
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    Nenhuma mensagem cadastrada. Clique em &quot;Nova Mensagem&quot; para começar.
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className="flex items-start justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors">
                      <div className="pr-8">
                        <p className="text-slate-700 leading-relaxed">{msg.content}</p>
                        <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${msg.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {msg.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => setEditingMessage(msg)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteMessage(msg.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

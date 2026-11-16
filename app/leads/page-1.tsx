'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { MessageSquare, Plus, Phone, Calendar, Trash2, UserPlus, Filter, Edit2, Zap, ChevronRight } from 'lucide-react'
import { GoogleGenAI } from '@google/genai';
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { LeadKpiHeader } from '@/components/leads/LeadKpiHeader'
import { Drawer } from '@/components/leads/Drawer'

const statusColors: Record<string, string> = {
  'Em Atendimento': 'bg-amber-100 text-amber-800 border-amber-200',
  'Atendido': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Descartado': 'bg-rose-100 text-rose-800 border-rose-200',
  'Stand-by': 'bg-sky-100 text-sky-800 border-sky-200',
}

interface Lead {
  id: string
  name: string
  whatsapp: string
  subject: string
  description: string
  status: 'Em Atendimento' | 'Atendido' | 'Descartado' | 'Stand-by'
  next_action_date?: string | null
  next_action_type?: string | null
  score?: string
  funnel_stage?: string
  ai_notes?: string | null
  history?: any[]
  indicator_id?: number | null
  prospecting_source?: string | null
}

const whatsappTemplates = [
    { label: "1. Saudação", text: "Olá {name}, tudo bem? Vi que você nos procurou sobre {subject}. Como posso ajudar agora?" },
    { label: "2. Cobrar Documentos", text: "Oi {name}, ainda estou aguardando os documentos para darmos andamento. Consegue me enviar?" },
    { label: "3. Follow-up", text: "Olá {name}, conseguiu avaliar nossa proposta? Qualquer dúvida estou à disposição!" }
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [filter, setFilter] = useState<string>('Todos') // 'Atenção Hoje', 'Todos', 'Em Atendimento', etc.
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [indicatorId, setIndicatorId] = useState<string>('')
  const [prospectingSource, setProspectingSource] = useState('')
  const [indicators, setIndicators] = useState<{id: number, name: string}[]>([])
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [insights, setInsights] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [activeWhatsappMenu, setActiveWhatsappMenu] = useState<string | null>(null);
  const [activeAgendaMenu, setActiveAgendaMenu] = useState<string | null>(null);
  const [callPromptLead, setCallPromptLead] = useState<Lead | null>(null);
  const [contractPromptLead, setContractPromptLead] = useState<Lead | null>(null);
  const [callNotes, setCallNotes] = useState('');
  const [contractCpf, setContractCpf] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [isAnalyzingId, setIsAnalyzingId] = useState<string | null>(null);

  useEffect(() => {
    // Check for saved API key in localStorage
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (savedKey) {
        setCustomApiKey(savedKey);
    }
  }, []);

  useEffect(() => {
    fetch('/api/fix-db')
      .then(res => res.json())
      .then(data => {
        console.log("RLS fix result:", data);
        fetchLeads();
      })
      .catch(err => {
        console.error("Error on fix-db:", err);
        fetchLeads();
      });
    
    // Fetch indicators
    supabase.from('indicators').select('id, name').then((res: any) => setIndicators((res.data as {id: number, name: string}[] | null) || []));
  }, [])

  const fetchLeads = async () => {
    if (!isSupabaseConfigured) return
    setIsLoading(true)
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (!error) setLeads(data || [])
    setIsLoading(false)
  }

  const handleWhatsappChange = (value: string) => {
    // Basic mask: (XX) XXXXX-XXXX
    let v = value.replace(/\D/g, '').substring(0, 11)
    if (v.length > 6) v = `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`
    else if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`
    else if (v.length > 0) v = `(${v}`
    setWhatsapp(v)
  }

  const addHistory = async (leadId: string, currentHistory: any[], action: string, type: string) => {
    const newHistory = [{
        date: new Date().toISOString(),
        action,
        type
    }, ...(currentHistory || [])];
    await supabase.from('leads').update({ history: newHistory }).eq('id', leadId);
    return newHistory;
  }

  const addLead = async () => {
    if (!name) {
      alert("Por favor, preencha o nome do cliente.");
      return;
    }
    
    setIsLoading(true);
    let generatedScore = '❄️ Frio';
    let generatedNotes = description;

    // AI Analysis during creation
    const apiKey = customApiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey && description) {
        try {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `Analise este lead. Descreva o problema em 2 linhas. Defina o nível de urgência/temperatura respondendo APENAS com um emoji (🔥 para Quente/Urgente, 🌤️ para Morno, ❄️ para Frio).
            
            Texto: "${description}"
            
            Formato de Resposta (JSON estrito):
            { "score": "🔥", "notes": "Descrição do problema..." }`;
            
            const result = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
            });
            const text = result.text || "";
            try {
                const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
                generatedScore = parsed.score || '❄️ Frio';
                generatedNotes = parsed.notes || description;
            } catch (e) {
                console.log("JSON parse failed, skipping AI structured response");
            }
        } catch (e) {
            console.error("Gemini skipped:", e);
        }
    }

    const initialHistory = [{
        date: new Date().toISOString(),
        action: 'Lead Entrou',
        type: 'system'
    }];

    const newLead = { 
      name, 
      whatsapp, 
      subject, 
      description,
      indicator_id: indicatorId ? parseInt(indicatorId) : null,
      prospecting_source: prospectingSource,
      environment: 'production',
      status: 'Em Atendimento',
      score: generatedScore,
      ai_notes: generatedNotes,
      history: initialHistory,
      next_action_type: 'Primeiro Contato',
      next_action_date: new Date().toISOString()
    };

    const { error } = await supabase.from('leads').insert([newLead]);
    setIsLoading(false);
    
    if (error) {
      console.error("Erro ao inserir lead:", error);
      alert(`Erro ao registrar lead: ${error.message}`);
    } else {
      console.log("Lead registrado com sucesso!");
      setName('');
      setWhatsapp('');
      setSubject('');
      setDescription('');
      setIndicatorId('');
      setProspectingSource('');
      setIsDrawerOpen(false)
      fetchLeads();
    }
  }

  const saveLead = async () => {
    if (!editingLead) return
    const { error } = await supabase.from('leads').update({
        name, whatsapp, subject, description,
        indicator_id: indicatorId ? parseInt(indicatorId) : null,
        prospecting_source: prospectingSource
    }).eq('id', editingLead.id)
    
    if (error) {
        alert("Erro ao editar: " + error.message)
    } else {
        setEditingLead(null)
        setName('')
        setWhatsapp('')
        setSubject('')
        setDescription('')
        setIndicatorId('')
        setProspectingSource('')
        setIsDrawerOpen(false)
        fetchLeads()
    }
  }

  const analyzeLead = async (desc: string) => {
    const apiKey = customApiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        setInsights('API Key do Gemini não configurada.')
        return
    }
    setIsAnalyzing(true)
    setInsights('')
    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Analise a descrição deste lead: "${desc}". (1) Identifique o sentimento do cliente (positivo/negativo/neutral). (2) Liste 3 pontos chave do problema. (3) Sugira a melhor abordagem de contato. Mantenha em bullets.`
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
        });
        setInsights(result.text || "");
    } catch (e: any) {
        console.error("Gemini Error:", e)
        setInsights(`Não foi possível gerar insights: ${e.message}`)
    } finally {
        setIsAnalyzing(false)
    }
  }

  const generateAiAnalysisForLead = async (lead: Lead) => {
    const apiKey = customApiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        alert('API Key do Gemini não configurada. Defina na área de configuração abaixo da lista.');
        return;
    }

    if (!lead.description) {
        alert('O lead não possui descrição para ser analisada.');
        return;
    }

    setIsAnalyzingId(lead.id);

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Analise este lead. Descreva o problema em 2 linhas. Defina o nível de urgência/temperatura respondendo APENAS com um emoji (🔥 para Quente/Urgente, 🌤️ para Morno, ❄️ para Frio).
        
        Texto: "${lead.description}"
        
        Formato de Resposta (JSON estrito):
        { "score": "🔥", "notes": "Descrição do problema..." }`;
        
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
        });
        const text = result.text || "";
        
        let generatedScore = lead.score;
        let generatedNotes = lead.ai_notes;
        
        try {
            const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            generatedScore = parsed.score || lead.score;
            generatedNotes = parsed.notes || text;
            
            await supabase.from('leads').update({
                score: generatedScore,
                ai_notes: generatedNotes
            }).eq('id', lead.id);
            
            await addHistory(lead.id, lead.history || [], 'Análise de IA gerada para o Lead', 'system');
            
            fetchLeads();
        } catch (e) {
            console.error("JSON parse failed", e);
            alert('Falha ao interpretar a resposta da IA.');
        }

    } catch (e: any) {
        console.error("Gemini Error:", e);
        alert(`Erro na IA: ${e.message}`);
    } finally {
        setIsAnalyzingId(null);
    }
  }

  const editLead = (lead: Lead) => {
    setEditingLead(lead)
    setName(lead.name)
    setWhatsapp(lead.whatsapp)
    setSubject(lead.subject)
    setDescription(lead.description)
    setIndicatorId(lead.indicator_id?.toString() || '')
    setProspectingSource(lead.prospecting_source || '')
    analyzeLead(lead.description)
    setIsDrawerOpen(true)
  }

  const updateStatus = async (id: string, status: Lead['status']) => {
    await supabase.from('leads').update({ status }).eq('id', id)
    fetchLeads()
  }

  const updateFunnelStage = async (lead: Lead, stage: string) => {
    await supabase.from('leads').update({ funnel_stage: stage }).eq('id', lead.id)
    await addHistory(lead.id, lead.history || [], `Avançou para ${stage}`, 'system');
    fetchLeads()
  }

  const handleSchedule = async (lead: Lead, days: number, label: string) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    await supabase.from('leads').update({ 
        next_action_date: d.toISOString(),
        next_action_type: label
    }).eq('id', lead.id);
    await addHistory(lead.id, lead.history || [], `Agendou: ${label}`, 'schedule');
    setActiveAgendaMenu(null);
    fetchLeads();
  }

  const handleWhatsappClick = async (lead: Lead, t: typeof whatsappTemplates[0]) => {
     await addHistory(lead.id, lead.history || [], `Enviada msg no WhatsApp (${t.label})`, 'communication');
     setActiveWhatsappMenu(null);
     const cleanPhone = lead.whatsapp.replace(/\D/g, '');
     let text = t.text.replace('{name}', lead.name).replace('{subject}', lead.subject || 'seu caso');
     window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  const handleCallComplete = async () => {
      if (!callPromptLead) return;
      await addHistory(callPromptLead.id, callPromptLead.history || [], `Ligou: ${callNotes || 'Sem anotações'}`, 'communication');
      setCallPromptLead(null);
      setCallNotes('');
      fetchLeads();
  }

  const finishContract = async () => {
      if (!contractPromptLead) return;
      
      const { error: clientError } = await supabase.from('clients').insert([{
        name: contractPromptLead.name,
        phone: contractPromptLead.whatsapp,
        cpf: contractCpf || null,
        status: 'Ativo',
        type: 'Pessoa Física',
      }]);

      if (clientError) {
        alert(`Erro ao criar cliente: ${clientError.message}`);
        return;
      }

      await supabase.from('leads').update({ status: 'Atendido', funnel_stage: 'Fechamento' }).eq('id', contractPromptLead.id);
      await addHistory(contractPromptLead.id, contractPromptLead.history || [], `Convertido em Cliente (Contrato Gerado)`, 'system');
      
      setContractPromptLead(null);
      setContractCpf('');
      setContractValue('');
      fetchLeads();
  }

  const convertToClient = async (lead: Lead) => {
    setContractPromptLead(lead);
  }

  const isLeadAtrasadoOuHoje = (l: Lead) => {
    return l.status === 'Em Atendimento' && (!l.next_action_date || new Date(l.next_action_date) <= new Date());
  };

  const counts: Record<string, number> = {
    'Requer Atenção Hoje': leads.filter(isLeadAtrasadoOuHoje).length,
    'Todos': leads.length,
    'Em Atendimento': leads.filter(l => l.status === 'Em Atendimento').length,
    'Atendido': leads.filter(l => l.status === 'Atendido').length,
    'Descartado': leads.filter(l => l.status === 'Descartado').length,
    'Stand-by': leads.filter(l => l.status === 'Stand-by').length,
  };

  const filteredLeads = leads.filter(l => {
    if (filter === 'Todos') return true;
    if (filter === 'Requer Atenção Hoje') return isLeadAtrasadoOuHoje(l);
    return l.status === filter;
  }).sort((a, b) => {
      // 1. Atrasados / Hoje primeiro (se em atendimento)
      const isAtrasadoA = isLeadAtrasadoOuHoje(a);
      const isAtrasadoB = isLeadAtrasadoOuHoje(b);
      
      if (isAtrasadoA && !isAtrasadoB) return -1;
      if (!isAtrasadoA && isAtrasadoB) return 1;

      // 2. Depois pela data da próxima ação
      const da = a.next_action_date ? new Date(a.next_action_date).getTime() : 0;
      const db = b.next_action_date ? new Date(b.next_action_date).getTime() : 0;
      return da - db;
  });

  const inputClass = "w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"

  const getFunnelIndex = (stage?: string) => {
    const stages = ['Contato', 'Qualificado', 'Proposta', 'Fechamento'];
    const idx = stages.indexOf(stage || 'Contato');
    return idx === -1 ? 0 : idx;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
            <ModuleHeader 
              icon={MessageSquare}
              title="Gestão de Leads" 
              description="Atendimento rápido e eficiente."
            />
            <button onClick={() => { setIsDrawerOpen(true); setEditingLead(null); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition w-full sm:w-auto justify-center">
                <Plus size={20} /> Novo Atendimento
            </button>
        </div>

        <LeadKpiHeader leads={leads} />

        <div className="flex gap-2 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <Filter size={18} className="text-slate-400 shrink-0" />
          {['Requer Atenção Hoje', 'Todos', 'Em Atendimento', 'Atendido', 'Descartado', 'Stand-by'].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)}
              className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-all", 
                  filter === f ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : 
                    f === 'Requer Atenção Hoje' ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200" :
                    "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              )}
            >
              {f}
              <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                  filter === f ? "bg-white/20 text-white" : 
                    f === 'Requer Atenção Hoje' ? "bg-rose-200 text-rose-800" :
                    "bg-slate-100 text-slate-500"
              )}>
                  {counts[f] || 0}
              </span>
            </button>
          ))}
        </div>

        <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingLead ? 'Editando Atendimento' : 'Novo Atendimento'}>
          <div className="space-y-4">
            <input placeholder="Nome do Cliente" className={inputClass} value={name} onChange={e => setName(e.target.value)} />
            <input placeholder="(00) 00000-0000" className={inputClass} value={whatsapp} onChange={e => handleWhatsappChange(e.target.value)} />
            <input placeholder="Assunto" className={inputClass} value={subject} onChange={e => setSubject(e.target.value)} />
            <textarea placeholder="Descrição do Problema" className={inputClass} rows={4} value={description} onChange={e => setDescription(e.target.value)} />
            
            <select className={inputClass} value={indicatorId} onChange={e => setIndicatorId(e.target.value)}>
                <option value="">Selecione um Indicador (Opcional)</option>
                {indicators.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
            </select>
            <input placeholder="Fonte de Prospecção" className={inputClass} value={prospectingSource} onChange={e => setProspectingSource(e.target.value)} />
            
            <button onClick={editingLead ? saveLead : addLead} className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 transition">
                {editingLead ? 'Salvar Alterações' : 'Registrar Lead'}
            </button>
            
            {insights && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-sm">
                <h4 className="font-bold mb-2">Insights do Inteligente:</h4>
                <div className="whitespace-pre-wrap">{insights}</div>
                </div>
            )}
            {isAnalyzing && <div className="p-4 text-sm text-slate-500">Analisando com Inteligência Artificial...</div>}

            <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Configuração (Opcional)</label>
                <input 
                    type="password"
                    placeholder="Sua Gemini API Key (Se o seu plano não for AI Studio)" 
                    className={inputClass + " text-sm"} 
                    value={customApiKey} 
                    onChange={e => {
                        setCustomApiKey(e.target.value);
                        if (e.target.value) {
                            localStorage.setItem('GEMINI_API_KEY', e.target.value);
                        } else {
                            localStorage.removeItem('GEMINI_API_KEY');
                        }
                    }} 
                />
            </div>
          </div>
        </Drawer>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 text-sm font-medium text-slate-500 w-16">Score</th>
                  <th className="p-4 text-sm font-medium text-slate-500">Lead</th>
                  <th className="p-4 text-sm font-medium text-slate-500 min-w-[200px]">Funil</th>
                  <th className="p-4 text-sm font-medium text-slate-500">Próxima Ação</th>
                  <th className="p-4 text-sm font-medium text-slate-500 text-center w-48">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
              {filteredLeads.map(lead => (
                <React.Fragment key={lead.id}>
                <tr 
                  onClick={() => setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)}
                  className={cn(
                      "cursor-pointer transition",
                      expandedLeadId === lead.id ? "bg-indigo-50/50" : "hover:bg-slate-50",
                      lead.score === '🔥' && expandedLeadId !== lead.id ? "bg-orange-50/30" : "",
                      lead.status === 'Em Atendimento' && (!lead.next_action_date || new Date(lead.next_action_date) <= new Date()) && expandedLeadId !== lead.id ? "bg-rose-50/30" : ""
                  )}
                >
                  <td className="p-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-lg" title={lead.score === '🔥' ? 'Lead Quente / Urgente' : ''} >
                        {lead.score || '❄️'}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-900">{lead.name}</div>
                    <div className="text-xs text-slate-500">{lead.whatsapp}</div>
                  </td>
                  <td className="p-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900 text-xs mb-2 uppercase flex items-center justify-between">
                        {lead.funnel_stage || 'Contato'}
                        {getFunnelIndex(lead.funnel_stage) < 3 && (
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const stages = ['Contato', 'Qualificado', 'Proposta', 'Fechamento'];
                                    const nextStage = stages[getFunnelIndex(lead.funnel_stage) + 1];
                                    updateFunnelStage(lead, nextStage); 
                                }} 
                                className="text-indigo-600 hover:text-indigo-800 text-[10px] bg-indigo-50 px-2 py-0.5 rounded-full flex items-center"
                                title="Avançar Funil Rapidamente"
                            >
                                Avançar <ChevronRight size={12} className="ml-0.5" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {['Contato', 'Qualificado', 'Proposta', 'Fechamento'].map((stage, idx) => {
                            const isPast = idx <= getFunnelIndex(lead.funnel_stage);
                            return (
                                <div key={stage} className={cn("h-1.5 w-8 rounded-full", isPast ? "bg-indigo-600" : "bg-slate-200")} title={stage} />
                            )
                        })}
                    </div>
                  </td>
                  <td className="p-4">
                     <div className="text-sm font-medium text-slate-900">{lead.next_action_type || "Agendar Reunião"}</div>
                     <div className={cn("text-xs font-semibold", (!lead.next_action_date || new Date(lead.next_action_date) <= new Date()) ? "text-rose-500" : "text-emerald-600")}>
                         {!lead.next_action_date ? "Sem Próxima Ação" : (new Date(lead.next_action_date) <= new Date() ? "Atrasado (Atenção)" : new Date(lead.next_action_date).toLocaleDateString())}
                     </div>
                  </td>
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-center relative">
                        <button onClick={() => { setActiveAgendaMenu(null); setActiveWhatsappMenu(activeWhatsappMenu === lead.id ? null : lead.id); }} className="text-emerald-600 p-2 hover:bg-emerald-50 rounded-lg" title="WhatsApp Rápido"><Zap size={16} /></button>
                        {activeWhatsappMenu === lead.id && (
                            <div className="absolute top-10 right-0 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden text-left">
                                <div className="p-3 bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                    <span>Templates de Abordagem</span>
                                    <button onClick={() => setActiveWhatsappMenu(null)} className="text-slate-400 hover:text-slate-600">×</button>
                                </div>
                                {whatsappTemplates.map(t => (
                                    <button 
                                        key={t.label} 
                                        className="w-full text-left block p-3 text-sm hover:bg-indigo-50 border-b last:border-0 text-slate-700 hover:text-indigo-700 transition"
                                        onClick={(e) => { e.stopPropagation(); handleWhatsappClick(lead, t); }}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button 
                            onClick={() => { 
                                window.open(`tel:${lead.whatsapp}`, '_self');
                                setCallPromptLead(lead); 
                            }} 
                            className="text-slate-500 p-2 hover:bg-slate-100 rounded-lg" title="Marcar Ligação"
                        >
                            <Phone size={16} />
                        </button>
                        
                        <div className="relative">
                            <button onClick={() => { setActiveWhatsappMenu(null); setActiveAgendaMenu(activeAgendaMenu === lead.id ? null : lead.id); }} className="text-slate-500 p-2 hover:bg-slate-100 rounded-lg" title="Agendar">
                                <Calendar size={16} />
                            </button>
                            {activeAgendaMenu === lead.id && (
                                <div className="absolute top-10 right-0 z-50 w-48 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden text-left">
                                     <div className="p-3 bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                        <span>Agendar</span>
                                        <button onClick={() => setActiveAgendaMenu(null)} className="text-slate-400 hover:text-slate-600">×</button>
                                     </div>
                                     <button onClick={() => handleSchedule(lead, 0, 'Reunião Hoje')} className="w-full text-left block p-3 text-sm hover:bg-indigo-50 border-b text-slate-700">Para Hoje</button>
                                     <button onClick={() => handleSchedule(lead, 1, 'Ligar Amanhã')} className="w-full text-left block p-3 text-sm hover:bg-indigo-50 border-b text-slate-700">Ligar Amanhã</button>
                                     <button onClick={() => handleSchedule(lead, 2, 'Mandar Mensagem')} className="w-full text-left block p-3 text-sm hover:bg-indigo-50 text-slate-700">Em 2 dias</button>
                                </div>
                            )}
                        </div>

                        <button onClick={() => convertToClient(lead)} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg" title="Avançar para Contrato"><UserPlus size={16} /></button>
                    </div>
                  </td>
                </tr>
                {expandedLeadId === lead.id && (
                    <tr className="bg-slate-50/80 border-b border-t shadow-inner">
                        <td colSpan={5} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Assunto & Descrição</h4>
                                    <div className="text-sm text-slate-900 font-medium mb-1">{lead.subject}</div>
                                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{lead.description}</p>
                                </div>
                                {lead.ai_notes ? (
                                    <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
                                        <h4 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
                                            <span className="text-lg">🤖</span> Análise da IA
                                        </h4>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{lead.ai_notes}</p>
                                    </div>
                                ) : (
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-slate-400 text-sm">
                                        <span className="mb-3">Nenhuma análise de IA disponível.</span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); generateAiAnalysisForLead(lead); }}
                                            disabled={isAnalyzingId === lead.id}
                                            className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors flex items-center gap-2"
                                        >
                                            <span className="text-lg">🤖</span> {isAnalyzingId === lead.id ? 'Analisando...' : 'Gerar Análise agora'}
                                        </button>
                                    </div>
                                )}
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Linha do Tempo</h4>
                                    <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                                        {lead.history && lead.history.length > 0 ? lead.history.map((h, i) => (
                                            <div key={i} className="flex gap-3 text-sm">
                                                <div className="text-slate-400 text-xs mt-0.5 whitespace-nowrap">
                                                    {new Date(h.date).toLocaleDateString()} {new Date(h.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </div>
                                                <div className="text-slate-700">{h.action}</div>
                                            </div>
                                        )) : (
                                            <div className="text-slate-400 text-sm">Nenhum histórico registrado.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex flex-wrap gap-2 items-center justify-between pt-4 border-t border-slate-100">
                                <div className="flex gap-2">
                                    <button onClick={() => editLead(lead)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition shadow-sm">Editar Lead</button>
                                    <button onClick={() => updateStatus(lead.id, 'Descartado')} className="px-4 py-2 bg-white border border-slate-200 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-50 transition shadow-sm">Descartar</button>
                                </div>
                                <div className="flex flex-wrap gap-2 items-center mt-4 md:mt-0">
                                    <span className="text-xs text-slate-500 font-medium mr-2 block w-full md:w-auto">Avançar Funil:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {['Contato', 'Qualificado', 'Proposta', 'Fechamento'].map((stage) => (
                                            <button 
                                                key={stage}
                                                onClick={() => updateFunnelStage(lead, stage)}
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-semibold border transition",
                                                    (lead.funnel_stage || 'Contato') === stage ? "border-indigo-600 text-indigo-700 bg-indigo-50" : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
                                                )}
                                            >
                                                {stage}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      
      {/* Call Prompt Modal */}
      <Drawer isOpen={!!callPromptLead} onClose={() => setCallPromptLead(null)} title="Feedback da Ligação">
        <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">Como foi a ligação com {callPromptLead?.name}?</h4>
            <textarea 
                className={inputClass} 
                rows={4} 
                placeholder="Ex: Cliente não atendeu, ligar amanhã. Ou: Demonstrou interesse, enviar proposta."
                value={callNotes}
                onChange={e => setCallNotes(e.target.value)}
            />
            <button onClick={handleCallComplete} className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition">
                Salvar Feedback
            </button>
        </div>
      </Drawer>

      {/* Contract Generate Modal */}
      <Drawer isOpen={!!contractPromptLead} onClose={() => setContractPromptLead(null)} title="Avançar para Contrato">
        <div className="space-y-4">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-4">
                <div className="text-sm font-semibold text-indigo-900">{contractPromptLead?.name}</div>
                <div className="text-xs text-indigo-700">{contractPromptLead?.whatsapp}</div>
                <div className="text-xs text-indigo-700 mt-1">{contractPromptLead?.subject}</div>
            </div>
            
            <input 
                placeholder="CPF do Cliente (Opcional por enquanto)" 
                className={inputClass} 
                value={contractCpf} 
                onChange={e => setContractCpf(e.target.value)} 
            />
            
            <input 
                placeholder="Valor Base dos Honorários (Ex: R$ 5.000,00)" 
                className={inputClass} 
                value={contractValue} 
                onChange={e => setContractValue(e.target.value)} 
            />

            <button onClick={finishContract} className="w-full px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition mt-4">
                Gerar Cliente e Fechar Contrato
            </button>
        </div>
      </Drawer>

    </DashboardLayout>
  )
}


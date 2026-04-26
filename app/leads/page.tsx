'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { MessageSquare, Plus, Phone, Calendar, Trash2, UserPlus, Filter, Edit2, Zap } from 'lucide-react'
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
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [insights, setInsights] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [activeWhatsappMenu, setActiveWhatsappMenu] = useState<string | null>(null);


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

  const addLead = async () => {
    if (!name) {
      alert("Por favor, preencha o nome do cliente.");
      return;
    }
    
    // Explicitly add environment as per system requirements
    const newLead = { 
      name, 
      whatsapp, 
      subject, 
      description,
      environment: 'production',
      status: 'Em Atendimento'
    };

    console.log("Tentando inserir lead:", newLead);
    const { error } = await supabase.from('leads').insert([newLead]);
    
    if (error) {
      console.error("Erro ao inserir lead:", error);
      alert(`Erro ao registrar lead: ${error.message}`);
    } else {
      console.log("Lead registrado com sucesso!");
      setName('');
      setWhatsapp('');
      setSubject('');
      setDescription('');
      setIsDrawerOpen(false)
      fetchLeads();
    }
  }

  const saveLead = async () => {
    if (!editingLead) return
    const { error } = await supabase.from('leads').update({
        name, whatsapp, subject, description
    }).eq('id', editingLead.id)
    
    if (error) {
        alert("Erro ao editar: " + error.message)
    } else {
        setEditingLead(null)
        setName('')
        setWhatsapp('')
        setSubject('')
        setDescription('')
        setIsDrawerOpen(false)
        fetchLeads()
    }
  }

  const analyzeLead = async (desc: string) => {
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
        setInsights('API Key do Gemini não configurada.')
        return
    }
    setIsAnalyzing(true)
    setInsights('')
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
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

  const editLead = (lead: Lead) => {
    setEditingLead(lead)
    setName(lead.name)
    setWhatsapp(lead.whatsapp)
    setSubject(lead.subject)
    setDescription(lead.description)
    analyzeLead(lead.description)
    setIsDrawerOpen(true)
  }

  const updateStatus = async (id: string, status: Lead['status']) => {
    await supabase.from('leads').update({ status }).eq('id', id)
    fetchLeads()
  }

  const updateFunnelStage = async (id: string, stage: string) => {
    await supabase.from('leads').update({ funnel_stage: stage }).eq('id', id)
    fetchLeads()
  }

  // Convert Lead to Client - simple direct implementation
  const convertToClient = async (lead: Lead) => {
    if (!confirm(`Converter ${lead.name} em cliente?`)) return
    
    // 1. Create client
    const { error: clientError } = await supabase.from('clients').insert([{
      name: lead.name,
      phone: lead.whatsapp,
      status: 'Ativo',
      type: 'Pessoa Física'
    }])

    if (clientError) {
      alert(`Erro ao converter: ${clientError.message}`)
      return
    }

    // 2. Mark lead as Atendido
    await updateStatus(lead.id, 'Atendido')
  }

  const filteredLeads = leads.filter(l => {
    if (filter === 'Todos') return true;
    if (filter === 'Requer Atenção Hoje') return l.status === 'Em Atendimento';
    return l.status === filter;
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
        <div className="flex justify-between items-center">
            <ModuleHeader 
              icon={MessageSquare}
              title="Gestão de Leads" 
              description="Atendimento rápido e eficiente."
            />
            <button onClick={() => { setIsDrawerOpen(true); setEditingLead(null); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 transition">
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
                  "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap", 
                  filter === f ? "bg-indigo-600 text-white" : 
                    f === 'Requer Atenção Hoje' ? "bg-rose-100 text-rose-700 hover:bg-rose-200" :
                    "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingLead ? 'Editando Atendimento' : 'Novo Atendimento'}>
          <div className="space-y-4">
            <input placeholder="Nome do Cliente" className={inputClass} value={name} onChange={e => setName(e.target.value)} />
            <input placeholder="(00) 00000-0000" className={inputClass} value={whatsapp} onChange={e => handleWhatsappChange(e.target.value)} />
            <input placeholder="Assunto" className={inputClass} value={subject} onChange={e => setSubject(e.target.value)} />
            <textarea placeholder="Descrição do Problema" className={inputClass} rows={4} value={description} onChange={e => setDescription(e.target.value)} />
            
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
          </div>
        </Drawer>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
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
                  className={cn("hover:bg-slate-50 transition-colors cursor-pointer", lead.status === 'Em Atendimento' && !lead.next_action_date ? "bg-rose-50/50" : "")}
                >
                  <td className="p-4">
                    <span className="text-xl" title={lead.score || "Frio"}>{lead.score?.includes('🔥') ? '🔥' : lead.score?.includes('🌤️') ? '🌤️' : lead.score?.includes('❄️') ? '❄️' : '🔥'}</span>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-900">{lead.name}</div>
                    <div className="text-xs text-slate-500">{lead.whatsapp}</div>
                  </td>
                  <td className="p-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900 text-xs mb-2 uppercase">{lead.funnel_stage || 'Contato'}</div>
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
                     <div className="text-xs text-rose-500 font-semibold">{!lead.next_action_date ? "Atrasado (Atenção)" : "Hoje"}</div>
                  </td>
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-center relative">
                        <button onClick={() => setActiveWhatsappMenu(activeWhatsappMenu === lead.id ? null : lead.id)} className="text-emerald-600 p-2 hover:bg-emerald-50 rounded-lg" title="WhatsApp Rápido"><Zap size={16} /></button>
                        {activeWhatsappMenu === lead.id && (
                            <div className="absolute top-10 right-0 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden text-left">
                                <div className="p-3 bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">Templates de Abordagem</div>
                                {whatsappTemplates.map(t => (
                                    <a 
                                        key={t.label} 
                                        href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(t.text.replace('{name}', lead.name).replace('{subject}', lead.subject))}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="block p-3 text-sm hover:bg-indigo-50 border-b last:border-0 text-slate-700 hover:text-indigo-700 transition"
                                        onClick={() => setActiveWhatsappMenu(null)}
                                    >
                                        {t.label}
                                    </a>
                                ))}
                            </div>
                        )}
                        <button className="text-slate-500 p-2 hover:bg-slate-100 rounded-lg" title="Marcar Ligação"><Phone size={16} /></button>
                        <button className="text-slate-500 p-2 hover:bg-slate-100 rounded-lg" title="Agendar"><Calendar size={16} /></button>
                        <button onClick={() => convertToClient(lead)} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg" title="Avançar para Contrato"><UserPlus size={16} /></button>
                    </div>
                  </td>
                </tr>
                {expandedLeadId === lead.id && (
                    <tr className="bg-slate-50/80 border-b border-t shadow-inner">
                        <td colSpan={5} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 text-sm">
                                        Nenhuma análise de IA disponível.
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 flex flex-wrap gap-2 items-center justify-between">
                                <div className="flex gap-2">
                                    <button onClick={() => editLead(lead)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition shadow-sm">Editar Lead</button>
                                    <button onClick={() => updateStatus(lead.id, 'Descartado')} className="px-4 py-2 bg-white border border-slate-200 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-50 transition shadow-sm">Descartar</button>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <span className="text-xs text-slate-500 font-medium mr-2">Avançar Funil:</span>
                                    {['Contato', 'Qualificado', 'Proposta', 'Fechamento'].map((stage) => (
                                        <button 
                                            key={stage}
                                            onClick={() => updateFunnelStage(lead.id, stage)}
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
                        </td>
                    </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}


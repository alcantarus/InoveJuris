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
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [filter, setFilter] = useState<string>('Todos')
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [insights, setInsights] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

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
        const genAI = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analise a descrição deste lead: "${desc}". (1) Identifique o sentimento do cliente (positivo/negativo/neutral). (2) Liste 3 pontos chave do problema. (3) Sugira a melhor abordagem de contato. Mantenha em bullets.`
        const result = await model.generateContent(prompt);
        setInsights(result.response.text());
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

  const filteredLeads = filter === 'Todos' ? leads : leads.filter(l => l.status === filter)

  const inputClass = "w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"

  return (
    <DashboardLayout>
      <div className="space-y-6">
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

        <div className="flex gap-2 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <Filter size={18} className="text-slate-400" />
          {['Todos', 'Em Atendimento', 'Atendido', 'Descartado', 'Stand-by'].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium", filter === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
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
                <th className="p-4 text-sm font-medium text-slate-500">Score</th>
                <th className="p-4 text-sm font-medium text-slate-500">Lead</th>
                <th className="p-4 text-sm font-medium text-slate-500">Assunto</th>
                <th className="p-4 text-sm font-medium text-slate-500 text-center">Status</th>
                <th className="p-4 text-sm font-medium text-slate-500 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.map(lead => (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <span className="text-xl">🔥</span>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-900">{lead.name}</div>
                    <div className="text-xs text-slate-500">{lead.whatsapp}</div>
                  </td>
                  <td className="p-4 text-sm text-slate-700">{lead.subject}</td>
                  <td className="p-4 text-center">
                      <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", statusColors[lead.status])}>
                          {lead.status}
                      </span>
                  </td>
                  <td className="p-4 flex gap-1 justify-center">
                    <button className="text-slate-500 p-2 hover:bg-slate-100 rounded-lg" title="WhatsApp"><Zap size={16} /></button>
                    <button className="text-slate-500 p-2 hover:bg-slate-100 rounded-lg" title="Ligar"><Phone size={16} /></button>
                    <button className="text-slate-500 p-2 hover:bg-slate-100 rounded-lg" title="Agendar"><Calendar size={16} /></button>
                    <button onClick={() => editLead(lead)} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg" title="Editar"><Edit2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}

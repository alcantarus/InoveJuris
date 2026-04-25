'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { MessageSquare, Plus, CheckCircle2, XCircle, Clock, Trash2, UserPlus, Filter } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { cn } from '@/lib/utils'

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
  const [filter, setFilter] = useState<string>('Todos')
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    if (!isSupabaseConfigured) return
    setIsLoading(true)
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (!error) setLeads(data || [])
    setIsLoading(false)
  }

  const addLead = async () => {
    if (!name) return
    const { error } = await supabase.from('leads').insert([{ name, whatsapp, subject, description, status: 'Em Atendimento' }])
    if (!error) {
      setName('')
      setWhatsapp('')
      setSubject('')
      setDescription('')
      fetchLeads()
    }
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleHeader 
          icon={MessageSquare}
          title="Gestão de Leads" 
          description="Atendimento rápido e eficiente."
        />

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

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-semibold text-lg">Novo Atendimento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Nome do Cliente" className="p-3 border rounded-xl" value={name} onChange={e => setName(e.target.value)} />
            <input placeholder="WhatsApp" className="p-3 border rounded-xl" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
            <input placeholder="Assunto" className="p-3 border rounded-xl md:col-span-2" value={subject} onChange={e => setSubject(e.target.value)} />
            <textarea placeholder="Descrição do Problema" className="p-3 border rounded-xl md:col-span-2" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <button onClick={addLead} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2">
            <Plus size={20} /> Registrar Lead
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Assunto</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.map(lead => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-bold">{lead.name}</div>
                    <div className="text-sm text-slate-500">{lead.whatsapp}</div>
                  </td>
                  <td className="p-4">{lead.subject}</td>
                  <td className="p-4 text-center">
                    <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value as any)} className="px-2 py-1 border rounded-lg text-sm bg-transparent">
                      <option>Em Atendimento</option>
                      <option>Atendido</option>
                      <option>Descartado</option>
                      <option>Stand-by</option>
                    </select>
                  </td>
                  <td className="p-4 flex gap-2 justify-center">
                    <button onClick={() => convertToClient(lead)} className="text-emerald-600 p-2 hover:bg-emerald-50 rounded-lg" title="Converter em Cliente"><UserPlus size={18} /></button>
                    <button className="text-red-500 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
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

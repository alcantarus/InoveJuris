import React from 'react'
import { Users, Clock, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiProps {
  leads: any[]
}

export function LeadKpiHeader({ leads }: KpiProps) {
  // Simple calculation for MVP
  const activeLeads = leads.filter(l => l.status === 'Em Atendimento' || l.status === 'Stand-by').length
  const atendidio = leads.filter(l => l.status === 'Atendido').length
  const total = leads.length
  const conversionRate = total > 0 ? Math.round((atendidio / total) * 100) : 0
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <KpiCard title="Leads Ativos" value={activeLeads} icon={Users} color="text-indigo-600" />
      <KpiCard title="Taxa de Conversão" value={`${conversionRate}%`} icon={Target} color="text-emerald-600" />
      <KpiCard title="Tempo Médio Resposta" value="2h" icon={Clock} color="text-amber-600" />
    </div>
  )
}

function KpiCard({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={cn("p-3 rounded-xl bg-slate-100", color)}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-sm text-slate-500 font-medium">{title}</div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      </div>
    </div>
  )
}

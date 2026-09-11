import React from 'react'
import { DollarSign, ShieldAlert, AlertOctagon, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function StrategicCockpit({ processes }: { processes: any[] }) {
  const totalValue = processes.reduce((acc, p) => acc + (p.case_value || 0), 0)
  
  const riskMatrix = processes.reduce((acc, p) => {
    const risk = p.risk_assessment || 'Possível'
    acc[risk] = (acc[risk] || 0) + 1
    return acc
  }, {} as any)
  
  const urgentCount = processes.filter(p => p.tags?.toLowerCase().includes('urgente')).length

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-lg flex items-center gap-4">
        <div className="p-3 bg-indigo-800 rounded-xl"><DollarSign className="text-indigo-300" /></div>
        <div>
          <p className="text-indigo-300 text-sm">Valor Total da Carteira</p>
          <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><ShieldAlert /></div>
        <div>
          <p className="text-slate-500 text-sm">Matriz de Risco (Provável)</p>
          <p className="text-2xl font-bold text-slate-900">{riskMatrix['Provável'] || 0} processos</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><AlertOctagon /></div>
        <div>
          <p className="text-slate-500 text-sm">Radar de Urgência</p>
          <p className="text-2xl font-bold text-slate-900">{urgentCount} pendentes</p>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { motion } from 'motion/react'
import { cn, formatDate, getDeadlineStatus, formatCurrency } from '@/lib/utils'
import { Scale, FileText, User, Clock, AlertTriangle, Calendar, Edit2, Trash2, RefreshCw, DollarSign } from 'lucide-react'

interface Process {
  id: number
  number: string
  client: string
  court: string
  type: string
  status: string
  last_update: string
  priority: string
  lawyer_id?: number | null
  history?: any[]
  process_deadlines?: any[]
  case_value?: number
}

interface BentoProcessGridProps {
  processes: Process[]
  onEdit: (p: Process) => void
  onDelete: (id: number) => void
  onSync: (p: Process) => void
  syncingId: number | null
  lawyers: any[]
  isVisible?: (key: string) => boolean
}

export function BentoProcessGrid({ processes, onEdit, onDelete, onSync, syncingId, lawyers, isVisible }: BentoProcessGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {processes.map((process, index) => (
        <motion.div
          key={process.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                process.court === 'INSS' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"
              )}>
                {process.court === 'INSS' ? <FileText size={20} /> : <Scale size={20} />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 leading-tight">{process.number}</h3>
                <p className="text-xs text-slate-500">{process.court}</p>
              </div>
            </div>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
              process.priority?.toLowerCase() === 'alta' ? "bg-rose-100 text-rose-700" : 
              process.priority?.toLowerCase() === 'média' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
            )}>
              {process.priority}
            </span>
          </div>

          {/* Grid Content */}
          <div className="grid grid-cols-1 gap-3 mb-6 flex-grow">
            {/* Timeline indicator - Visual History */}
            <div className="flex items-center gap-1 mb-2">
              {['Distribuição', 'Concluso', 'Julgado'].map((stage, i) => (
                <div key={stage} className={cn(
                  "h-1 flex-1 rounded-full",
                  i <= (process.history?.length || 0) - 1 ? "bg-indigo-500" : "bg-slate-200"
                )} />
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
              <User size={16} className="text-indigo-400" />
              <span className="font-medium text-slate-800">{process.client}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
              <Clock size={16} className="text-indigo-400" />
              <span>{process.status}</span>
            </div>

            {process.case_value ? (
              <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-500" />
                  <span className="text-xs text-slate-400 font-medium uppercase">Valor da Causa</span>
                </div>
                <span className="font-bold text-slate-900">{formatCurrency(process.case_value, isVisible ? isVisible('process_all') : true)}</span>
              </div>
            ) : null}
            
            {/* Next Deadline Highlight */}
            {(process.process_deadlines && process.process_deadlines.length > 0) && (
              <div className="mt-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                 <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Próximo Prazo</p>
                 {process.process_deadlines.sort((a: any, b: any) => new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime())[0] && (
                   <div className="flex items-center justify-between text-sm font-semibold text-indigo-900">
                     <span className="truncate">{process.process_deadlines[0].description}</span>
                     <span>{formatDate(process.process_deadlines[0].deadline_date)}</span>
                   </div>
                 )}
              </div>
            )}
            
            {/* Context-aware suggestions */}
            <div className="flex flex-wrap gap-2 mt-2">
              {process.status === 'Em Análise' && (
                <button className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">Verificar documentos</button>
              )}
              {process.status === 'Sentença' && (
                <button className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">Gerar Recurso</button>
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
            <div className="flex gap-1">
              <button onClick={() => onEdit(process)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Editar"><Edit2 size={16} /></button>
              <button onClick={() => onDelete(process.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Excluir"><Trash2 size={16} /></button>
            </div>
            <button 
              onClick={() => onSync(process)}
              disabled={syncingId === process.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={syncingId === process.id ? "animate-spin" : ""} />
              {syncingId === process.id ? '...' : 'Sinc'}
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

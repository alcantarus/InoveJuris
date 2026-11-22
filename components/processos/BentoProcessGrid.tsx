import React from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import { usePrivacyVersion } from '@/lib/usePrivacyVersion'
import { getNextDeadline, getResponsibleName } from '@/lib/processes'
import {
  ArrowUpRight,
  Calendar,
  DollarSign,
  Edit2,
  FileText,
  LockKeyhole,
  RefreshCw,
  Scale,
  Trash2,
  User,
} from 'lucide-react'

interface Process {
  id: number
  number: string
  client: string
  court: string
  type: string
  status: string
  last_update?: string
  priority: string
  lawyer_id?: number | null
  responsible_name?: string | null
  lawyers?: any
  history?: any[]
  process_deadlines?: any[]
  case_value?: number
  phase?: string | null
  secret_justice?: boolean
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
  usePrivacyVersion()
  const showValues = isVisible ? isVisible('process_all') : true

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {processes.map((process, index) => {
        const nextDeadline = getNextDeadline(process)
        const responsible = getResponsibleName(process, lawyers)
        const stages = ['Distribuição', 'Concluso', 'Julgado']
        const currentStage = Math.min(Math.max(process.history?.length || 0, 0), stages.length) - 1

        return (
          <motion.div
            key={process.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all flex flex-col"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "p-2 rounded-lg shrink-0",
                  process.court === 'INSS' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"
                )}>
                  {process.court === 'INSS' ? <FileText size={20} /> : <Scale size={20} />}
                </div>
                <div className="min-w-0">
                  <Link href={`/processos/${process.id}`} className="font-bold text-slate-900 leading-tight hover:text-indigo-600 hover:underline block truncate">
                    {process.number}
                  </Link>
                  <p className="text-xs text-slate-500 truncate">{process.phase || process.court}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                  process.priority?.toLowerCase() === 'alta' ? "bg-rose-100 text-rose-700" :
                  process.priority?.toLowerCase() === 'média' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                )}>
                  {process.priority}
                </span>
                {process.secret_justice && (
                  <span title="Segredo de justiça" className="text-rose-500"><LockKeyhole size={12} /></span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-6 flex-grow">
              <div className="flex items-center gap-1 mb-2">
                {stages.map((stage, i) => (
                  <div key={stage} className={cn(
                    "h-1 flex-1 rounded-full",
                    i <= currentStage ? "bg-indigo-500" : "bg-slate-200"
                  )} />
                ))}
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                <User size={16} className="text-indigo-400 shrink-0" />
                <span className="font-medium text-slate-800 truncate">{process.client}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                <Scale size={16} className="text-indigo-400 shrink-0" />
                <span className="truncate">{responsible}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                <Calendar size={16} className="text-indigo-400 shrink-0" />
                <span className="truncate">{process.status}</span>
              </div>

              {process.case_value ? (
                <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-emerald-500" />
                    <span className="text-xs text-slate-400 font-medium uppercase">Valor da Causa</span>
                  </div>
                  <span className="font-bold text-slate-900">{formatCurrency(Number(process.case_value), showValues)}</span>
                </div>
              ) : null}

              {nextDeadline && (
                <div className="mt-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Próximo Prazo</p>
                  <div className="flex items-center justify-between text-sm font-semibold text-indigo-900 gap-2">
                    <span className="truncate">{nextDeadline.description}</span>
                    <span className="shrink-0">{formatDate(nextDeadline.deadline_date)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
              <div className="flex gap-1">
                <Link
                  href={`/processos/${process.id}`}
                  title="Abrir processo"
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  Abrir <ArrowUpRight size={12} />
                </Link>
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
        )
      })}
    </div>
  )
}

'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowUpRight, CalendarClock, Edit2, ExternalLink, LockKeyhole, RefreshCw, Trash2 } from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { daysUntilDate, getNextDeadline, getResponsibleName, isActiveProcess } from '@/lib/processes'

interface Process {
  id: number
  number: string
  client: string
  court: string
  type: string
  status: string
  priority: string
  lawyer_id?: number | null
  responsible_name?: string | null
  lawyers?: any
  case_value?: number
  secret_justice?: boolean
  phase?: string | null
  process_deadlines?: any[]
  history?: any[]
}

interface ProcessTableProps {
  processes: Process[]
  lawyers: any[]
  isVisible?: (key: string) => boolean
  syncingId: number | null
  onEdit: (process: Process) => void
  onDelete: (id: number) => void
  onSync: (process: Process) => void
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '—'
}

function deadlineLabel(process: Process): { text: string; className: string } {
  const next = getNextDeadline(process)
  if (!next) return { text: 'Sem prazo', className: 'text-slate-400' }
  const days = daysUntilDate(next.deadline_date)
  if (days < 0) return { text: `${formatDate(next.deadline_date)} · vencido`, className: 'text-rose-600' }
  if (days === 0) return { text: `${formatDate(next.deadline_date)} · hoje`, className: 'text-amber-600' }
  if (days <= 7) return { text: `${formatDate(next.deadline_date)} · ${days}d`, className: 'text-indigo-600' }
  return { text: formatDate(next.deadline_date), className: 'text-slate-600' }
}

export function ProcessTable({ processes, lawyers, isVisible, syncingId, onEdit, onDelete, onSync }: ProcessTableProps) {
  const showValues = isVisible ? isVisible('process_all') : true

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[980px]">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-bold">Cliente / CNJ</th>
              <th className="px-4 py-3 font-bold">Área / Vara</th>
              <th className="px-4 py-3 font-bold">Responsável</th>
              <th className="px-4 py-3 font-bold">Próximo prazo</th>
              <th className="px-4 py-3 font-bold">Valor da causa</th>
              <th className="px-4 py-3 font-bold">Situação</th>
              <th className="px-4 py-3 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {processes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  Nenhum processo encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
            {processes.map(process => {
              const deadline = deadlineLabel(process)
              const responsible = getResponsibleName(process, lawyers)
              const active = isActiveProcess(process.status)

              return (
                <tr key={process.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/processos/${process.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline line-clamp-1"
                        >
                          {process.client || 'Cliente não informado'}
                        </Link>
                        <p className="font-mono text-[11px] text-slate-500 mt-0.5">{process.number}</p>
                      </div>
                      {process.secret_justice && (
                        <span title="Segredo de justiça" className="shrink-0 p-1 rounded-md bg-rose-50 text-rose-600">
                          <LockKeyhole size={12} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700 font-medium">{process.type || '—'}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{process.phase || process.court || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700">
                        {initials(responsible)}
                      </span>
                      <span className="text-slate-700 line-clamp-1">{responsible}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className={cn('flex items-center gap-1.5 text-xs font-semibold', deadline.className)}>
                      <CalendarClock size={13} /> {deadline.text}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-700">
                    {process.case_value ? formatCurrency(Number(process.case_value), showValues) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-block px-2 py-1 rounded-md border text-[10px] font-bold',
                        active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      )}
                    >
                      {active ? 'Ativo' : process.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/processos/${process.id}`}
                        title="Abrir processo"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors"
                      >
                        Abrir <ArrowUpRight size={13} />
                      </Link>
                      <button onClick={() => onSync(process)} disabled={syncingId === process.id} title="Sincronizar DataJud" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50">
                        <RefreshCw size={15} className={syncingId === process.id ? 'animate-spin' : ''} />
                      </button>
                      <button onClick={() => onEdit(process)} title="Editar" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => onDelete(process.id)} title="Excluir" className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>
          {processes.length} {processes.length === 1 ? 'processo exibido' : 'processos exibidos'}
        </span>
        <span className="inline-flex items-center gap-1">
          <ExternalLink size={12} /> Clique em Abrir para ver dados, prazos e partes
        </span>
      </div>
    </div>
  )
}

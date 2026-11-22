'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowUpRight, CalendarClock, Edit2, ExternalLink, LockKeyhole, RefreshCw, Trash2 } from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { usePrivacyVersion } from '@/lib/usePrivacyVersion'
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

const EMPTY_MESSAGE = 'Nenhum processo encontrado para os filtros selecionados.'

interface ProcessRowData {
  deadline: { text: string; className: string }
  responsible: string
  active: boolean
}

/** Dados derivados usados tanto na tabela quanto nos cards. */
function getRowData(process: Process, lawyers: any[]): ProcessRowData {
  return {
    deadline: deadlineLabel(process),
    responsible: getResponsibleName(process, lawyers),
    active: isActiveProcess(process.status),
  }
}

function StatusBadge({ active, status }: { active: boolean; status: string }) {
  return (
    <span
      className={cn(
        'inline-block px-2 py-1 rounded-md border text-[10px] font-bold',
        active
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-100 text-slate-600 border-slate-200'
      )}
    >
      {active ? 'Ativo' : status}
    </span>
  )
}

function DeadlineInfo({ deadline, className }: { deadline: ProcessRowData['deadline']; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 font-semibold text-xs', className, deadline.className)}>
      <CalendarClock size={13} /> {deadline.text}
    </div>
  )
}

function ResponsibleInfo({ responsible, clamp = true }: { responsible: string; clamp?: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700">
        {initials(responsible)}
      </span>
      <span className={cn('text-slate-700', clamp && 'line-clamp-1')}>{responsible}</span>
    </div>
  )
}

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <div className="mt-0.5 min-w-0 break-words text-sm text-slate-700">{children}</div>
    </div>
  )
}

export function ProcessTable({ processes, lawyers, isVisible, syncingId, onEdit, onDelete, onSync }: ProcessTableProps) {
  usePrivacyVersion()
  const showValues = isVisible ? isVisible('process_all') : true

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Visão desktop */}
      <div className="hidden md:block overflow-x-auto">
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
                  {EMPTY_MESSAGE}
                </td>
              </tr>
            )}
            {processes.map(process => {
              const row = getRowData(process, lawyers)

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
                    <ResponsibleInfo responsible={row.responsible} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <DeadlineInfo deadline={row.deadline} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-700">
                    {process.case_value ? formatCurrency(Number(process.case_value), showValues) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge active={row.active} status={process.status} />
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

      {/* Visão mobile: cards empilhados, sem rolagem horizontal */}
      <div className="md:hidden divide-y divide-slate-100">
        {processes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{EMPTY_MESSAGE}</div>
        ) : (
          processes.map(process => {
            const row = getRowData(process, lawyers)

            return (
              <div key={process.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Cliente / CNJ</p>
                    <Link
                      href={`/processos/${process.id}`}
                      className="mt-0.5 block break-words text-sm font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                    >
                      {process.client || 'Cliente não informado'}
                    </Link>
                    <p className="mt-0.5 break-all font-mono text-[11px] text-slate-500">{process.number}</p>
                  </div>
                  {process.secret_justice && (
                    <span title="Segredo de justiça" className="shrink-0 p-1 rounded-md bg-rose-50 text-rose-600">
                      <LockKeyhole size={14} />
                    </span>
                  )}
                </div>
                <MobileField label="Área / Vara">
                  <p className="break-words font-medium text-slate-700">{process.type || '—'}</p>
                  <p className="break-words text-xs text-slate-500">{process.phase || process.court || '—'}</p>
                </MobileField>
                <MobileField label="Responsável">
                  <ResponsibleInfo responsible={row.responsible} clamp={false} />
                </MobileField>
                <MobileField label="Próximo prazo">
                  <DeadlineInfo deadline={row.deadline} className="text-sm" />
                </MobileField>
                <MobileField label="Valor da causa">
                  <span className="text-slate-700">
                    {process.case_value ? formatCurrency(Number(process.case_value), showValues) : '—'}
                  </span>
                </MobileField>
                <MobileField label="Situação">
                  <StatusBadge active={row.active} status={process.status} />
                </MobileField>
                <div className="min-w-0 pt-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Ações</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Link
                      href={`/processos/${process.id}`}
                      className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-indigo-50 px-3 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
                    >
                      Abrir <ArrowUpRight size={14} />
                    </Link>
                    <button
                      onClick={() => onSync(process)}
                      disabled={syncingId === process.id}
                      className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-indigo-50 disabled:opacity-50"
                    >
                      <RefreshCw size={15} className={syncingId === process.id ? 'animate-spin' : ''} />
                      {syncingId === process.id ? 'Sincronizando' : 'Sincronizar'}
                    </button>
                    <button
                      onClick={() => onEdit(process)}
                      className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-indigo-50"
                    >
                      <Edit2 size={15} /> Editar
                    </button>
                    <button
                      onClick={() => onDelete(process.id)}
                      className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-rose-50 px-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                    >
                      <Trash2 size={15} /> Excluir
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
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

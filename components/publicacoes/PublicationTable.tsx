'use client'

import React from 'react'
import { ArrowUpRight, FileSearch } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { type PublicationItem } from '@/lib/publications'

export const publicationStatusClasses: Record<string, string> = {
  'A triar': 'bg-amber-100 text-amber-800 border-amber-200',
  Triada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Ignorada: 'bg-slate-100 text-slate-600 border-slate-200',
  Arquivada: 'bg-indigo-100 text-indigo-800 border-indigo-200',
}

function lawyerSummary(item: PublicationItem): string {
  const lawyers = item.recipients.filter(recipient => recipient.lawyer)
  if (lawyers.length > 0) {
    return lawyers.slice(0, 2).map(lawyer => {
      const oab = lawyer.oab ? ` (OAB ${lawyer.oab}${lawyer.ufOab ? '/' + lawyer.ufOab : ''})` : ''
      return `${lawyer.lawyer}${oab}`
    }).join(', ') + (lawyers.length > 2 ? ` +${lawyers.length - 2}` : '')
  }
  const parties = item.recipients.filter(recipient => !recipient.lawyer).slice(0, 2)
  return parties.length > 0 ? parties.map(recipient => recipient.name).join(', ') : '—'
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-block px-2 py-1 rounded-md border text-[10px] font-bold whitespace-nowrap',
      publicationStatusClasses[status]
    )}>
      {status}
    </span>
  )
}

function SourceBadge({ source, className }: { source: string; className?: string }) {
  return (
    <span className={cn(
      'mt-1 inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase',
      className
    )}>
      {source}
    </span>
  )
}

function DeadlineRef({ deadlineId }: { deadlineId: number | null }) {
  if (!deadlineId) return null
  return <p className="mt-1 text-[10px] font-bold text-emerald-700">Prazo #{deadlineId}</p>
}

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <div className="mt-0.5 min-w-0 break-words text-sm text-slate-700">{children}</div>
    </div>
  )
}

interface PublicationTableProps {
  items: PublicationItem[]
  onSelect: (item: PublicationItem) => void
}

export function PublicationTable({ items, onSelect }: PublicationTableProps) {
  if (items.length === 0) {
    return (
      <div className="py-14 text-center">
        <FileSearch className="mx-auto text-slate-300" size={36} />
        <p className="mt-3 text-sm text-slate-500">Nenhuma publicação encontrada para os filtros selecionados.</p>
        <p className="mt-1 text-xs text-slate-400">Use “Sincronizar DJEN” para trazer novas publicações.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Visão desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-bold">CNJ</th>
              <th className="px-4 py-3 font-bold">Tribunal</th>
              <th className="px-4 py-3 font-bold">Data</th>
              <th className="px-4 py-3 font-bold">Processo</th>
              <th className="px-4 py-3 font-bold">Advogado</th>
              <th className="px-4 py-3 font-bold">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => (
              <tr
                key={item.id}
                onClick={() => onSelect(item)}
                className="cursor-pointer hover:bg-indigo-50/40 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="font-mono text-[11px] font-semibold text-slate-800">{item.processNumber || 'Sem CNJ'}</p>
                  <SourceBadge source={item.source} />
                </td>
                <td className="px-4 py-3 max-w-[220px]">
                  <p className="font-semibold text-slate-800">{item.court || '—'}</p>
                  <p className="text-[11px] text-slate-500 truncate">{item.unit || 'Órgão não informado'}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="font-semibold text-slate-800">{item.publicationDate ? formatDate(item.publicationDate) : '—'}</p>
                  {item.page && <p className="text-[11px] text-slate-400">p. {item.page}</p>}
                </td>
                <td className="px-4 py-3 max-w-[230px]">
                  <p className="font-semibold text-slate-800 truncate">{item.clientName || item.documentType || 'Processo não vinculado'}</p>
                  <p className="text-[11px] text-slate-500 truncate">{item.chamber || '—'}</p>
                </td>
                <td className="px-4 py-3 max-w-[220px] text-slate-600 text-[11px] truncate">{lawyerSummary(item)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                  <DeadlineRef deadlineId={item.deadlineId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Visão mobile: cards empilhados, sem rolagem horizontal */}
      <div className="md:hidden divide-y divide-slate-100">
        {items.map(item => (
          <div key={item.id} className="p-4 space-y-3" onClick={() => onSelect(item)}>
            <MobileField label="CNJ">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="break-all font-mono text-sm font-semibold text-slate-800">
                  {item.processNumber || 'Sem CNJ'}
                </span>
                <SourceBadge source={item.source} className="mt-0" />
              </div>
            </MobileField>
            <MobileField label="Tribunal">
              <p className="break-words font-medium text-slate-800">{item.court || '—'}</p>
              <p className="break-words text-xs text-slate-500">{item.unit || 'Órgão não informado'}</p>
            </MobileField>
            <MobileField label="Data">
              <p className="font-semibold text-slate-800">
                {item.publicationDate ? formatDate(item.publicationDate) : '—'}
              </p>
              {item.page && <p className="text-xs text-slate-400">p. {item.page}</p>}
            </MobileField>
            <MobileField label="Processo">
              <p className="break-words font-semibold text-slate-800">
                {item.clientName || item.documentType || 'Processo não vinculado'}
              </p>
              <p className="break-words text-xs text-slate-500">{item.chamber || '—'}</p>
            </MobileField>
            <MobileField label="Advogado">
              <span className="break-words text-sm text-slate-600">{lawyerSummary(item)}</span>
            </MobileField>
            <MobileField label="Situação">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={item.status} />
                <DeadlineRef deadlineId={item.deadlineId} />
              </div>
            </MobileField>
            <MobileField label="Responsável">
              <span className="break-words text-sm text-slate-700">{item.responsibleName || 'Não atribuído'}</span>
            </MobileField>
            <MobileField label="Decisão">
              <span className="break-words text-sm text-slate-700">
                {item.decision || '—'}
                {item.decisionNotes ? ` — ${item.decisionNotes}` : ''}
              </span>
            </MobileField>
            <MobileField label="Leitura">
              <span className="text-sm text-slate-700">
                {item.readAt ? `Lido em ${formatDate(item.readAt)}` : 'Não lido'}
              </span>
            </MobileField>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="min-w-0 text-xs text-slate-400">Toque para ler o texto e decidir</span>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); onSelect(item) }}
                className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-3 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                Ler e triar <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import React from 'react'
import { FileSearch } from 'lucide-react'
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
    <div className="overflow-x-auto">
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
                <span className="mt-1 inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase">
                  {item.source}
                </span>
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
                <span className={cn(
                  'inline-block px-2 py-1 rounded-md border text-[10px] font-bold whitespace-nowrap',
                  publicationStatusClasses[item.status]
                )}>
                  {item.status}
                </span>
                {item.deadlineId && (
                  <p className="mt-1 text-[10px] font-bold text-emerald-700">Prazo #{item.deadlineId}</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

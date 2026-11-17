'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowUpRight, CalendarClock } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { BUCKET_LABELS, type DeadlineItem } from '@/lib/deadlines'
import { bucketClasses } from './CalendarGrid'

interface DeadlineListViewProps {
  items: DeadlineItem[]
}

export function DeadlineListView({ items }: DeadlineListViewProps) {
  if (items.length === 0) {
    return (
      <div className="py-14 text-center">
        <CalendarClock className="mx-auto text-slate-300" size={36} />
        <p className="mt-3 text-sm text-slate-500">Nenhum prazo encontrado para os filtros selecionados.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3 font-bold">Vencimento</th>
            <th className="px-4 py-3 font-bold">Prazo / Cliente</th>
            <th className="px-4 py-3 font-bold">Processo</th>
            <th className="px-4 py-3 font-bold">Responsável</th>
            <th className="px-4 py-3 font-bold">Área</th>
            <th className="px-4 py-3 font-bold">Situação</th>
            <th className="px-4 py-3 font-bold text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap">
                <p className="font-semibold text-slate-800">{formatDate(item.deadlineDate)}</p>
                <p className={cn('text-[11px] mt-0.5', item.daysRemaining < 0 ? 'text-rose-600' : 'text-slate-400')}>
                  {item.bucket === 'concluido'
                    ? 'Concluído'
                    : item.daysRemaining < 0
                      ? `Venceu há ${Math.abs(item.daysRemaining)} dias`
                      : item.daysRemaining === 0
                        ? 'Vence hoje'
                        : `Em ${item.daysRemaining} dias`}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-900">{item.description}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{item.clientName}</p>
              </td>
              <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{item.processNumber}</td>
              <td className="px-4 py-3 text-slate-700">{item.responsible}</td>
              <td className="px-4 py-3 text-slate-600">{item.area}</td>
              <td className="px-4 py-3">
                <span className={cn('inline-block px-2 py-1 rounded-md border text-[10px] font-bold', bucketClasses[item.bucket])}>
                  {BUCKET_LABELS[item.bucket]}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {item.process_id != null ? (
                  <Link
                    href={`/processos/${item.process_id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors"
                  >
                    Abrir <ArrowUpRight size={13} />
                  </Link>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowUpRight, CalendarClock, Pencil, Trash2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { BUCKET_LABELS, type DeadlineItem } from '@/lib/deadlines'
import { bucketClasses } from './CalendarGrid'

interface DeadlineListViewProps {
  items: DeadlineItem[]
  onEdit?: (item: DeadlineItem) => void
  onDelete?: (item: DeadlineItem) => void
}

// Compartilhado entre a tabela (desktop) e os cards (mobile) para evitar
// divergência de texto, cores e ações entre as duas visualizações.
function daysLabel(item: DeadlineItem): string {
  if (item.bucket === 'concluido') return 'Concluído'
  if (item.daysRemaining < 0) return `Venceu há ${Math.abs(item.daysRemaining)} dias`
  if (item.daysRemaining === 0) return 'Vence hoje'
  return `Em ${item.daysRemaining} dias`
}

function daysClass(item: DeadlineItem): string {
  return item.daysRemaining < 0 ? 'text-rose-600' : 'text-slate-400'
}

function StatusBadge({ item }: { item: DeadlineItem }) {
  return (
    <span className={cn('inline-block px-2 py-1 rounded-md border text-[10px] font-bold', bucketClasses[item.bucket])}>
      {BUCKET_LABELS[item.bucket]}
    </span>
  )
}

function DeadlineActions({ item, onEdit, onDelete, mobile = false }: {
  item: DeadlineItem
  onEdit?: (item: DeadlineItem) => void
  onDelete?: (item: DeadlineItem) => void
  mobile?: boolean
}) {
  const baseClass = 'inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors'
  const sizeClass = mobile ? 'min-h-[40px] px-3 bg-slate-50 text-xs font-bold' : 'p-2'
  const deleteClass = mobile ? 'min-h-[40px] px-3 bg-rose-50 text-xs font-bold' : 'p-2'
  return (
    <div className={cn('flex items-center gap-1', mobile && 'flex-wrap gap-2')}>
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(item)}
          title="Editar prazo"
          className={cn(baseClass, sizeClass, 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50')}
        >
          <Pencil size={14} />
          {mobile && 'Editar prazo'}
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(item)}
          title="Excluir prazo"
          className={cn(baseClass, deleteClass, 'text-rose-500 hover:text-rose-700 hover:bg-rose-50')}
        >
          <Trash2 size={14} />
          {mobile && 'Excluir prazo'}
        </button>
      )}
      {item.process_id != null ? (
        <Link
          href={`/processos/${item.process_id}`}
          title="Abrir processo"
          className={cn(baseClass, sizeClass, 'text-indigo-600 hover:bg-indigo-50')}
        >
          <ArrowUpRight size={14} />
          {mobile && 'Abrir processo'}
        </Link>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      )}
    </div>
  )
}

function MobileField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <div className="mt-0.5 text-sm text-slate-700 break-words">{children}</div>
    </div>
  )
}

export function DeadlineListView({ items, onEdit, onDelete }: DeadlineListViewProps) {
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
      <table className="w-full min-w-[900px] text-left text-sm hidden md:table">
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
                <p className={cn('text-[11px] mt-0.5', daysClass(item))}>
                  {daysLabel(item)}
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
                <StatusBadge item={item} />
              </td>
              <td className="px-4 py-3">
                <DeadlineActions item={item} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-slate-100">
        {items.map(item => (
          <div key={item.id} className="p-4 space-y-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Prazo / Cliente</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 break-words">{item.description}</p>
              <p className="mt-0.5 text-xs text-slate-500 break-words">{item.clientName}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="Vencimento" className="col-span-2">
                <span className="font-semibold text-slate-800">{formatDate(item.deadlineDate)}</span>
                <span className={cn('mt-0.5 block text-xs', daysClass(item))}>{daysLabel(item)}</span>
              </MobileField>
              <MobileField label="Processo" className="col-span-2">
                <span className="font-mono text-[11px] break-all">{item.processNumber}</span>
              </MobileField>
              <MobileField label="Responsável">{item.responsible}</MobileField>
              <MobileField label="Área">{item.area}</MobileField>
              <MobileField label="Situação" className="col-span-2">
                <StatusBadge item={item} />
              </MobileField>
              <MobileField label="Ação" className="col-span-2">
                <DeadlineActions item={item} onEdit={onEdit} onDelete={onDelete} mobile />
              </MobileField>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { deleteDeadlineRecord } from '@/lib/deadline-mutations'
import { formatDate } from '@/lib/utils'

export interface DeleteDeadlineTarget {
  id: string | number
  description?: string | null
  deadlineDate?: string | null
  processNumber?: string | null
  clientName?: string | null
}

interface DeleteDeadlineModalProps {
  target: DeleteDeadlineTarget | null
  userId?: number | null
  source?: string
  onDeleted: () => void | Promise<void>
  onClose: () => void
}

/** Confirmação e exclusão de prazos (prazo, perícia, cumprimento, etc.). */
export function DeleteDeadlineModal({
  target,
  userId,
  source = 'prazos',
  onDeleted,
  onClose,
}: DeleteDeadlineModalProps) {
  const [reason, setReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (target) {
      setReason('')
      setDeleting(false)
    }
  }, [target])

  const handleDelete = async () => {
    if (!target || deleting) return
    setDeleting(true)

    const result = await deleteDeadlineRecord(target.id, reason.trim(), userId ?? null, source)
    if (result.error) {
      setDeleting(false)
      toast.error('Não foi possível excluir o prazo.', { description: result.error })
      return
    }

    toast.success('Prazo excluído. A exclusão foi registrada na auditoria.')
    try {
      await onDeleted()
    } finally {
      setDeleting(false)
      onClose()
    }
  }

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={() => { if (!deleting) onClose() }}
      title="Excluir prazo"
    >
      {target && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl border border-rose-100 bg-rose-50">
            <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-900 leading-relaxed">
              O prazo será removido de Processos, Prazos e Calendário. A exclusão fica registrada na trilha de
              auditoria e não pode ser desfeita.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 break-words">{target.description || 'Prazo processual'}</p>
            {target.deadlineDate && (
              <p className="text-xs text-slate-600">Vencimento: {formatDate(target.deadlineDate)}</p>
            )}
            {target.clientName && <p className="text-xs text-slate-600 break-words">{target.clientName}</p>}
            {target.processNumber && <p className="text-xs font-mono text-slate-500 break-all">{target.processNumber}</p>}
          </div>

          <div>
            <label htmlFor="delete-deadline-reason" className="block text-xs font-bold text-slate-600 mb-1.5">
              Motivo da exclusão <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea
              id="delete-deadline-reason"
              rows={3}
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="Ex.: prazo cancelado pelo tribunal, lançamento duplicado..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 resize-y"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="min-h-[40px] px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deleting ? 'Excluindo...' : 'Excluir prazo'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

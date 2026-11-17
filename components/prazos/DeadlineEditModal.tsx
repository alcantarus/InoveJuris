'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CalendarClock, CheckCircle2, Info } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { cn, formatDate } from '@/lib/utils'
import {
  combineDeadlineDateTime,
  splitDeadlineDateTime,
  updateDeadlineRecord,
  type DeadlineEditTarget,
} from '@/lib/deadline-mutations'

interface DeadlineEditModalProps {
  deadline: DeadlineEditTarget | null
  lawyers: any[]
  userId: number | null
  source: 'prazos' | 'processo' | 'calendario'
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export function DeadlineEditModal({
  deadline,
  lawyers,
  userId,
  source,
  onClose,
  onSaved,
}: DeadlineEditModalProps) {
  const initial = useMemo(() => splitDeadlineDateTime(deadline?.deadlineDate), [deadline])
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [description, setDescription] = useState(deadline?.description || '')
  const [status, setStatus] = useState(deadline?.status || 'Pendente')
  const [responsibleId, setResponsibleId] = useState<string>(
    deadline?.responsibleId != null ? String(deadline.responsibleId) : ''
  )
  const [justification, setJustification] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const next = splitDeadlineDateTime(deadline?.deadlineDate)
    setDate(next.date)
    setTime(next.time)
    setDescription(deadline?.description || '')
    setStatus(deadline?.status || 'Pendente')
    setResponsibleId(deadline?.responsibleId != null ? String(deadline.responsibleId) : '')
    setJustification('')
  }, [deadline])

  const dateChanged = Boolean(deadline) && combineDeadlineDateTime(date, time) !== combineDeadlineDateTime(initial.date, initial.time)

  const statusOptions = useMemo(() => {
    const options = ['Pendente', 'Em andamento', 'Concluído', 'Cancelado']
    if (deadline?.status && !options.includes(deadline.status)) options.unshift(deadline.status)
    return options
  }, [deadline?.status])

  const save = async () => {
    if (!deadline) return
    if (!date || !description.trim()) {
      toast.error('Informe a data e a descrição do prazo.')
      return
    }
    if (dateChanged && !justification.trim()) {
      toast.error('Informe a justificativa da nova data.', {
        description: 'O reagendamento precisa ficar registrado no histórico do prazo.',
      })
      return
    }

    setSaving(true)
    const result = await updateDeadlineRecord({
      deadline,
      deadlineDate: combineDeadlineDateTime(date, time),
      description,
      status,
      responsibleId: responsibleId ? Number(responsibleId) : null,
      justification: justification.trim() || undefined,
      userId,
      source,
    })
    setSaving(false)

    if (result.error) {
      toast.error('Não foi possível salvar as alterações.', { description: result.error })
      return
    }

    toast.success(
      dateChanged
        ? 'Data alterada. O prazo foi reaberto para confirmação.'
        : 'Prazo atualizado com sucesso.',
      { description: dateChanged ? 'A alteração foi registrada no histórico.' : undefined }
    )
    onClose()
    await onSaved()
  }

  return (
    <Modal
      isOpen={Boolean(deadline)}
      onClose={onClose}
      title="Editar prazo"
    >
      {deadline && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Processo</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              {deadline.processNumber || 'Sem número'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{deadline.clientName || 'Cliente não informado'}</p>
          </div>

          {dateChanged && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-900">
                Ao alterar a data, a confirmação anterior é reaberta e o prazo volta para <strong>Pendente</strong>.
                O calendário e a listagem de processos refletirão a nova data.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Nova data</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Hora (opcional)</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Descrição</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex.: Perícia médica judicial"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Situação</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400"
              >
                {statusOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Responsável</label>
              <select
                value={responsibleId}
                onChange={e => setResponsibleId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400"
              >
                <option value="">Manter responsável atual</option>
                {lawyers.map((lawyer: any) => (
                  <option key={lawyer.id} value={lawyer.id}>
                    {lawyer.name || lawyer.users?.name || `Advogado #${lawyer.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Justificativa {dateChanged && <span className="text-rose-600">*</span>}
            </label>
            <textarea
              value={justification}
              onChange={e => setJustification(e.target.value)}
              rows={3}
              placeholder="Ex.: Perícia médica antecipada pela decisão de fl. 120"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 resize-none"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Obrigatória quando a data muda. Fica registrada no histórico do prazo.
            </p>
          </div>

          {deadline.calculationMemory && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                <Info size={12} /> Memória de cálculo original
              </p>
              <p className="mt-1 text-xs whitespace-pre-wrap text-indigo-900">{deadline.calculationMemory}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            {deadline.businessDays != null && (
              <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> {deadline.businessDays} dias úteis</span>
            )}
            {deadline.confirmedAt && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 size={12} /> Confirmado em {formatDate(deadline.confirmedAt)}
              </span>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={cn(
                'px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700',
                saving && 'opacity-60 cursor-wait'
              )}
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

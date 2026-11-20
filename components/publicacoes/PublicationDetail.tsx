'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { Modal } from '@/components/Modal'
import { cn, formatDate, getTodayBR } from '@/lib/utils'
import { getAppEnv } from '@/lib/env'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import {
  addBusinessDays,
  buildCalculationMemory,
  suggestDeadlineDays,
  type PublicationItem,
  type PublicationLawyerOption,
  type PublicationProcessOption,
} from '@/lib/publications'

type Mode = 'view' | 'ignore' | 'deadline'

interface PublicationDetailProps {
  publication: PublicationItem | null
  processes: PublicationProcessOption[]
  lawyers: PublicationLawyerOption[]
  onClose: () => void
  onChanged: () => void
}

const PublicationSummary = React.memo(function PublicationSummary({ publication }: { publication: PublicationItem }) {
  const pageLabel = publication.page
    ? `p. ${publication.page}`
    : publication.communicationNumber
      ? `Comunicação nº ${publication.communicationNumber}`
      : '—'

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Disponibilidade</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {publication.publicationDate ? formatDate(publication.publicationDate) : '—'}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Câmara</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{publication.chamber || '—'}</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Página</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{pageLabel}</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Importância</p>
          <p className="mt-1 text-sm font-semibold text-indigo-700">
            {publication.importance || (publication.suggestedDays ? `${publication.suggestedDays} dia(s) · sugestão` : 'Não classificada')}
          </p>
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <p className="font-mono text-xs font-bold text-slate-800">{publication.processNumber || 'Sem CNJ'}</p>
        <p className="text-slate-600">
          <strong className="text-slate-800">{publication.court || 'Tribunal não informado'}</strong>
          {publication.unit ? ` · ${publication.unit}` : ''}
        </p>
        <p className="text-xs text-slate-500">
          Origem: {publication.source} · Situação: <strong>{publication.status}</strong>
          {publication.responsibleName !== 'Não atribuído' && ` · Responsável: ${publication.responsibleName}`}
        </p>
        {publication.clientName && <p className="text-xs text-slate-500">Cliente: {publication.clientName}</p>}
      </div>

      {publication.recipients.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-700 mb-1">Destinatários</p>
          <div className="flex flex-wrap gap-1.5">
            {publication.recipients.slice(0, 8).map((recipient, index) => (
              <span key={`${recipient.name}-${index}`} className="px-2 py-1 rounded-lg bg-slate-100 text-[11px] text-slate-600">
                {recipient.lawyer ? `${recipient.lawyer}${recipient.oab ? ` · OAB ${recipient.oab}/${recipient.ufOab || ''}` : ''}` : recipient.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
})

export function PublicationDetail({ publication, processes, lawyers, onClose, onChanged }: PublicationDetailProps) {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('view')
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [processId, setProcessId] = useState('')
  const [lawyerId, setLawyerId] = useState('')
  const [days, setDays] = useState('5')
  const [deadlineDate, setDeadlineDate] = useState(getTodayBR())
  const [description, setDescription] = useState('')
  const [importance, setImportance] = useState('')
  const [justification, setJustification] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!publication) return
    const suggested = publication.suggestedDays ?? suggestDeadlineDays(publication.content)
    const safeDays = Math.min(Math.max(suggested ?? 5, 1), 60)
    setMode('view')
    setExpanded(false)
    setSaving(false)
    setProcessId(publication.processId ? String(publication.processId) : '')
    setLawyerId(publication.responsibleId ? String(publication.responsibleId) : '')
    setDays(String(safeDays))
    setDeadlineDate(addBusinessDays(publication.publicationDate || getTodayBR(), safeDays))
    setDescription(`Prazo por publicação — ${publication.court || publication.source}`)
    setImportance(publication.importance || (suggested ? `${suggested} dia(s)` : ''))
    setJustification('')
    setNotes('')
  }, [publication?.id])

  // Registra a leitura uma única vez por publicação.
  useEffect(() => {
    if (!publication || publication.readAt) return
    void getSupabase()
      .from('publications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', publication.id)
      .eq('environment', getAppEnv())
  }, [publication?.id])

  if (!publication) return null

  const client = getSupabase()
  const env = getAppEnv()

  const changeDays = (value: string) => {
    const parsed = Math.min(Math.max(Number(value) || 1, 1), 60)
    setDays(String(parsed))
    setDeadlineDate(addBusinessDays(publication.publicationDate || getTodayBR(), parsed))
  }

  const updateDecision = async (payload: Record<string, any>, successMessage: string) => {
    setSaving(true)
    try {
      const { error } = await client.from('publications').update({
        updated_at: new Date().toISOString(),
        ...('reviewed_by' in payload
          ? {}
          : { reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() }),
        ...payload,
      }).eq('id', publication.id).eq('environment', env)
      if (error) throw error
      toast.success(successMessage)
      onChanged()
      onClose()
    } catch (error: any) {
      toast.error('Não foi possível registrar a decisão.', { description: error?.message })
    } finally {
      setSaving(false)
    }
  }

  const handleIgnore = () => {
    if (!notes.trim()) {
      toast.error('Informe o motivo para ignorar a publicação.')
      return
    }
    void updateDecision({
      status: 'Ignorada',
      decision: 'Ignorada',
      decision_notes: notes.trim(),
    }, 'Publicação ignorada e registrada.')
  }

  const handleClassify = () => {
    void updateDecision({
      status: 'Triada',
      decision: 'Classificada sem prazo',
      decision_notes: notes.trim() || null,
      importance: importance.trim() || null,
      suggested_days: days ? Number(days) : null,
      responsible_id: lawyerId ? Number(lawyerId) : null,
      process_id: processId ? Number(processId) : null,
    }, 'Publicação classificada. Nenhum prazo foi criado.')
  }

  const handleReopen = () => {
    void updateDecision({
      status: 'A triar',
      decision: null,
      decision_notes: null,
      reviewed_by: null,
      reviewed_at: null,
    }, 'Publicação reaberta para triagem.')
  }

  const handleCreateDeadline = async () => {
    if (!processId) {
      toast.error('Selecione o processo para o qual o prazo será criado.')
      return
    }
    if (!deadlineDate) {
      toast.error('Informe a data de vencimento.')
      return
    }
    if (!justification.trim()) {
      toast.error('A criação do prazo exige confirmação expressa: descreva a justificativa.')
      return
    }

    setSaving(true)
    try {
      const businessDays = Math.min(Math.max(Number(days) || 1, 1), 60)
      const selectedProcess = processes.find(option => String(option.id) === processId)

      const { data: inserted, error: deadlineError } = await client.from('process_deadlines').insert([{
        process_id: Number(processId),
        deadline_date: deadlineDate,
        description: description.trim() || 'Prazo por publicação',
        status: 'Pendente',
        environment: env,
        notification_date: publication.publicationDate || null,
        publication_date: publication.publicationDate || null,
        count_start_date: publication.publicationDate || null,
        business_days: businessDays,
        calculation_memory: buildCalculationMemory(
          publication.publicationDate,
          businessDays,
          deadlineDate,
          publication.source
        ),
        responsible_id: lawyerId ? Number(lawyerId) : null,
        confirmed_at: new Date().toISOString(),
        confirmed_by: user?.id ?? null,
        justification: justification.trim(),
      }]).select('id').single()

      if (deadlineError) throw deadlineError

      const { error: publicationError } = await client.from('publications').update({
        status: 'Triada',
        decision: 'Prazo criado',
        decision_notes: justification.trim(),
        importance: importance.trim() || `${businessDays} dia(s)`,
        suggested_days: businessDays,
        responsible_id: lawyerId ? Number(lawyerId) : null,
        process_id: Number(processId),
        process_number: selectedProcess?.number ? selectedProcess.number.replace(/\D/g, '') : publication.processNumberRaw,
        deadline_id: inserted?.id ?? null,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        read_at: publication.readAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', publication.id).eq('environment', env)

      if (publicationError) throw publicationError

      toast.success('Prazo criado após confirmação expressa.')
      onChanged()
      onClose()
    } catch (error: any) {
      toast.error('Não foi possível criar o prazo.', { description: error?.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={Boolean(publication)}
      onClose={onClose}
      title="Detalhe da publicação"
      className="max-w-3xl"
    >
      <div className="space-y-5">
        <PublicationSummary publication={publication} />

        <div>
          <button
            type="button"
            onClick={() => setExpanded(previous => !previous)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-bold hover:bg-indigo-100 transition-colors"
          >
            {expanded ? <EyeOff size={15} /> : <BookOpen size={15} />}
            {expanded ? 'Ocultar texto' : 'Ler o texto'}
          </button>
          {expanded && (
            <pre className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap break-words max-h-72 overflow-y-auto custom-scrollbar font-sans">
              {publication.content || 'Teor não disponível nesta publicação.'}
            </pre>
          )}
          {publication.link && (
            <a href={publication.link} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline">
              Abrir inteiro teor no tribunal <ExternalLink size={12} />
            </a>
          )}
        </div>

        {publication.decision && (
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600">
            <p className="font-bold text-slate-800">Decisão registrada: {publication.decision}</p>
            {publication.decisionNotes && <p className="mt-1 whitespace-pre-wrap">{publication.decisionNotes}</p>}
            {publication.reviewedAt && <p className="mt-1 text-slate-400">Em {formatDate(publication.reviewedAt)}</p>}
          </div>
        )}

        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900">
            Nenhum prazo é criado pela importação. A criação exige leitura, classificação e confirmação expressa
            do advogado responsável. A data sugerida considera apenas fins de semana (sem feriados/recessos).
          </div>

          {mode === 'view' && (
            <div className="flex flex-wrap gap-2">
              {publication.status === 'A triar' ? (
                <>
                  <button type="button" onClick={() => setMode('deadline')}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
                    <CalendarPlus size={15} /> Criar prazo
                  </button>
                  <button type="button" onClick={() => setMode('ignore')}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50">
                    <XCircle size={15} /> Ignorar
                  </button>
                  <button type="button" onClick={handleClassify} disabled={saving}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-60">
                    <CheckCircle2 size={15} /> Classificar sem prazo
                  </button>
                </>
              ) : (
                <button type="button" onClick={handleReopen} disabled={saving}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
                  <RotateCcw size={15} /> Reabrir para triagem
                </button>
              )}
            </div>
          )}

          {mode === 'ignore' && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-slate-600">Motivo da decisão</span>
                <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Ex.: publicação já acompanhada em outro processo, sem prazo para esta parte..."
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 resize-y" />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={handleIgnore} disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60">
                  {saving ? 'Salvando...' : 'Confirmar ignoração'}
                </button>
                <button type="button" onClick={() => setMode('view')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {mode === 'deadline' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Processo *</span>
                  <select value={processId} onChange={e => setProcessId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400">
                    <option value="">Selecione o processo</option>
                    {processes.map(option => (
                      <option key={option.id} value={option.id}>{option.number} — {option.client}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Advogado responsável</span>
                  <select value={lawyerId} onChange={e => setLawyerId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400">
                    <option value="">Não atribuído</option>
                    {lawyers.map(option => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-bold text-slate-600">Dias úteis (sugestão)</span>
                  <input type="number" min={1} max={60} value={days} onChange={e => changeDays(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-bold text-slate-600">Vencimento confirmado *</span>
                  <input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-slate-600">Descrição do prazo</span>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-600">Importância</span>
                <input value={importance} onChange={e => setImportance(e.target.value)} placeholder="Ex.: 5 dias"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-600">Confirmação expressa do advogado *</span>
                <textarea rows={3} value={justification} onChange={e => setJustification(e.target.value)}
                  placeholder="Descreva a leitura e o motivo do prazo. Este campo registra a confirmação responsável."
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 resize-y" />
              </label>

              <p className={cn('text-[11px] text-slate-500')}>
                Memória de cálculo: contagem de {days} dia(s) úteis a partir de{' '}
                {publication.publicationDate ? formatDate(publication.publicationDate) : 'data não informada'},
                {' '}com vencimento em {deadlineDate ? formatDate(deadlineDate) : '—'}. Feriados e recessos não foram considerados.
              </p>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleCreateDeadline} disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
                  <CheckCircle2 size={15} /> {saving ? 'Criando...' : 'Confirmar e criar prazo'}
                </button>
                <button type="button" onClick={() => setMode('view')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

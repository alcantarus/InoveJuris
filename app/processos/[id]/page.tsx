'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  History,
  type LucideIcon,
  LockKeyhole,
  Newspaper,
  Pencil,
  RefreshCw,
  Scale,
  Save,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react'
import DashboardLayout from '@/app/dashboard-layout'
import { cn, formatCurrency, formatDate, formatDateTime, getTodayBR } from '@/lib/utils'
import { usePrivacyVersion } from '@/lib/usePrivacyVersion'
import { daysUntilDate, getNextDeadline, getResponsibleName, normalizeParties } from '@/lib/processes'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getAppEnv } from '@/lib/env'
import { useAuth } from '@/lib/auth'
import { confirmDeadlineRecord } from '@/lib/deadline-mutations'
import type { ProcessTimeline as ProcessTimelineData } from '@/lib/process-timeline'
import { ProcessTimeline } from '@/components/processos/ProcessTimeline'
import { DeadlineEditModal } from '@/components/prazos/DeadlineEditModal'
import { DeleteDeadlineModal, type DeleteDeadlineTarget } from '@/components/prazos/DeleteDeadlineModal'

function DataField({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <div className="flex items-start gap-2 text-sm text-slate-800 break-words">
        {Icon && <Icon size={15} className="text-indigo-400 shrink-0 mt-0.5" />}
        <span className="min-w-0">{value || '—'}</span>
      </div>
    </div>
  )
}

export default function ProcessoDetalhePage() {
  usePrivacyVersion()
  const params = useParams<{ id: string }>()
  const { user } = useAuth()
  const [process, setProcess] = useState<any>(null)
  const [lawyers, setLawyers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [refreshingPublications, setRefreshingPublications] = useState(false)
  const [unifiedTimeline, setUnifiedTimeline] = useState<ProcessTimelineData | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [editingDeadline, setEditingDeadline] = useState<any | null>(null)
  const [deletingDeadline, setDeletingDeadline] = useState<DeleteDeadlineTarget | null>(null)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    // O detalhe precisa usar o mesmo ambiente de Prazos/Calendário e das RPCs
    // de mutação; sem estes filtros um processo podia ser aberto pela URL com
    // prazos de outro ambiente e a exclusão/criação falhava com P0002.
    const env = getAppEnv()
    const [processRes, lawyersRes, contractsRes, clientsRes] = await Promise.all([
      supabase
        .from('processes')
        .select('*, process_deadlines(*)')
        .eq('id', Number(params.id))
        .eq('environment', env)
        .eq('process_deadlines.environment', env)
        .single(),
      supabase.from('lawyers').select('id, name, users:user_id(name)').eq('environment', env),
      supabase.from('contracts').select('processNumber, client_id').eq('environment', env),
      supabase.from('clients').select('id, name').eq('environment', env),
    ])

    if (processRes.error || !processRes.data) {
      toast.error('Processo não encontrado neste ambiente.')
      setLoading(false)
      return
    }

    const data: any = processRes.data
    const contract = (contractsRes.data || []).find((c: any) => c.processNumber === data.number)
    const client = contract ? (clientsRes.data || []).find((c: any) => c.id === contract.client_id) : null

    setProcess({
      ...data,
      client: client?.name || data.client,
      process_deadlines: Array.isArray(data.process_deadlines)
        ? data.process_deadlines.slice().sort((a: any, b: any) => String(a.deadline_date).localeCompare(String(b.deadline_date)))
        : [],
      history: Array.isArray(data.history)
        ? data.history.slice().sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
        : [],
    })
    setNotes(data.internal_notes || '')
    setLawyers(lawyersRes.data || [])
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    load()
  }, [load])

  const loadTimeline = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setTimelineLoading(false)
      return
    }
    setTimelineLoading(true)
    try {
      const response = await fetch(`/api/processes/${params.id}/timeline`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Não foi possível carregar a timeline.')
      setUnifiedTimeline(data as ProcessTimelineData)
    } catch (error) {
      console.error('[processo] falha ao carregar timeline unificada:', error)
    } finally {
      setTimelineLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    loadTimeline()
  }, [loadTimeline])

  // Mantém o detalhe do processo alinhado a Prazos e Calendário sem recarregar a página.
  useEffect(() => {
    const channel = supabase
      .channel(`processo-${params.id}-deadlines`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'process_deadlines' }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, params.id])

  const responsible = useMemo(() => getResponsibleName(process, lawyers), [process, lawyers])
  const nextDeadline = useMemo(() => getNextDeadline(process), [process])
  const parties = useMemo(() => normalizeParties(process?.parties), [process])

  const handleSync = async () => {
    if (!process?.number) return
    setSyncing(true)
    try {
      const response = await fetch('/api/process-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ process_id: process.id, process_number: process.number }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(`${data.movements} andamento(s) atualizado(s).`)
        await load()
        await loadTimeline()
      } else {
        toast.error(data.error || 'Não foi possível sincronizar o processo.')
      }
    } catch (error) {
      console.error(error)
      toast.error('Erro na comunicação com a API de sincronização.')
    } finally {
      setSyncing(false)
    }
  }

  const handleRefreshPublications = async () => {
    setRefreshingPublications(true)
    try {
      const response = await fetch(`/api/processes/${params.id}/refresh-publications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      })
      const data = await response.json()
      if (!response.ok || data.success === false) {
        throw new Error(data?.error || 'Não foi possível atualizar as publicações.')
      }
      toast.success(
        `${data.inserted} publicação(ões) nova(s), ${data.updated} atualizada(s).`
      )
      await loadTimeline()
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : 'Erro ao consultar o DJEN para este processo.'
      )
    } finally {
      setRefreshingPublications(false)
    }
  }

  const handleConfirm = async (deadline: any) => {
    setConfirmingId(deadline.id)
    const { error } = await confirmDeadlineRecord(deadline.id, user?.id ?? null)

    setConfirmingId(null)
    if (error) {
      toast.error('Não foi possível confirmar o prazo.', { description: error })
      return
    }
    toast.success('Prazo confirmado pelo advogado responsável.')
    await load()
  }

  const toDeleteTarget = (deadline: any): DeleteDeadlineTarget => ({
    id: deadline.id,
    description: deadline.description,
    deadlineDate: deadline.deadline_date,
    processNumber: process.number,
    clientName: process.client,
  })

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    const { error } = await supabase
      .from('processes')
      .update({ internal_notes: notes, updated_by: user?.id || null })
      .eq('id', process.id)
    setSavingNotes(false)
    if (error) {
      toast.error('Não foi possível salvar as anotações.', { description: error.message })
      return
    }
    toast.success('Anotações salvas.')
    await load()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  if (!process) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto mt-16 text-center">
          <FileText className="mx-auto text-slate-300" size={48} />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Processo não encontrado</h1>
          <Link href="/processos" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:underline">
            <ArrowLeft size={15} /> Voltar para Processos
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const timeline = [
    { label: 'Disponibilização DJEN', date: nextDeadline?.notification_date || nextDeadline?.created_at },
    { label: 'Publicação', date: nextDeadline?.publication_date },
    { label: 'Início da contagem', date: nextDeadline?.count_start_date },
    { label: 'Vencimento', date: nextDeadline?.deadline_date },
  ]

  const days = nextDeadline ? daysUntilDate(nextDeadline.deadline_date) : null
  const confirmed = Boolean(nextDeadline?.confirmed_at)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs text-slate-500 flex-wrap">
              <Link href="/processos" className="hover:text-indigo-600 hover:underline">Processos</Link>
              <ChevronRight size={12} />
              <span className="font-mono">{process.number}</span>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">{process.client || 'Cliente não informado'}</h1>
              {process.secret_justice && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-bold">
                  <LockKeyhole size={12} /> Segredo de justiça
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1 font-mono">{process.number}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/processos"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft size={16} /> Voltar
            </Link>
            <button
              onClick={handleRefreshPublications}
              disabled={refreshingPublications}
              title="Consulta apenas este número CNJ no DJEN — sem varrer a carteira"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 text-sm font-semibold hover:bg-sky-100 disabled:opacity-60"
            >
              <Newspaper size={16} className={refreshingPublications ? 'animate-pulse' : ''} />
              {refreshingPublications ? 'Atualizando publicações...' : 'Atualizar publicações'}
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar movimentações'}
            </button>
          </div>
        </div>

        {/* Dados do processo — modelo 06-processo.md */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Scale size={18} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Dados do processo</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <DataField label="Área" value={process.type} icon={Scale} />
            <DataField label="Fase" value={process.phase} icon={History} />
            <DataField label="Vara" value={process.court} icon={Building2} />
            <DataField label="Comarca" value={process.comarca} icon={Building2} />
            <DataField label="Tribunal" value={process.tribunal} icon={Scale} />
            <DataField label="Valor da causa" value={formatCurrency(Number(process.case_value || 0))} icon={FileText} />
            <DataField label="Distribuição" value={process.distribution_date ? formatDate(process.distribution_date) : null} icon={CalendarClock} />
            <DataField label="Última movimentação" value={process.last_update?.includes('T') ? formatDateTime(process.last_update) : process.last_update} icon={Clock} />
            <DataField label="Responsável" value={responsible} icon={User} />
            <DataField label="Fonte de cadastro" value={process.source || 'Manual'} icon={RefreshCw} />
            <DataField label="Situação" value={process.status} icon={ShieldCheck} />
            <DataField label="Prioridade" value={process.priority} icon={AlertTriangle} />
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Anotações</p>
            <div className="flex items-start gap-3">
              <p className="flex-1 text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-3">
                {process.internal_notes || 'Nenhuma anotação registrada.'}
              </p>
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                title="Salvar anotações"
                className="shrink-0 p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
              >
                <Save size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* Próximo prazo com timeline e confirmação */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Próximo prazo</h2>
            </div>
            {nextDeadline && (
              <span className={cn(
                'px-2 py-1 rounded-lg text-[10px] font-bold',
                days !== null && days < 0 ? 'bg-rose-100 text-rose-700' :
                days === 0 ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-700'
              )}>
                {days !== null && days < 0 ? `Vencido há ${Math.abs(days!)} dias` : days === 0 ? 'Vence hoje' : `Em ${days} dias`}
              </span>
            )}
          </div>

          {!nextDeadline ? (
            <p className="text-sm text-slate-500">Nenhum prazo cadastrado para este processo.</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <p className="text-lg font-bold text-slate-900">{nextDeadline.description || 'Prazo processual'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Vencimento: <strong>{formatDate(nextDeadline.deadline_date)}</strong> · Responsável: {responsible}
                  </p>
                  {nextDeadline.business_days != null && (
                    <p className="text-xs text-indigo-600 mt-1 font-semibold">{nextDeadline.business_days} dias úteis</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDeadline({ ...nextDeadline, processNumber: process.number, clientName: process.client })}
                  title="Editar data ou descrição do prazo"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Pencil size={15} /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingDeadline(toDeleteTarget(nextDeadline))}
                  title="Excluir prazo"
                  className="inline-flex min-h-[40px] items-center gap-2 px-3 py-2 rounded-xl border border-rose-200 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 size={15} /> Excluir
                </button>
                <button
                  onClick={() => handleConfirm(nextDeadline)}
                  disabled={confirmingId === nextDeadline.id || confirmed}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors',
                    confirmed
                      ? 'bg-emerald-50 text-emerald-700 cursor-default'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60'
                  )}
                >
                  {confirmed ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
                  {confirmed ? 'Confirmado' : confirmingId === nextDeadline.id ? 'Confirmando...' : 'Confirmar'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                {timeline.map((step, index) => (
                  <div key={step.label} className="relative rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Passo {index + 1}</p>
                    <p className="text-xs font-semibold text-slate-700 mt-1">{step.label}</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">
                      {step.date ? formatDate(String(step.date)) : '—'}
                    </p>
                  </div>
                ))}
              </div>

              {nextDeadline.calculation_memory && (
                <div className="mt-4 p-3 rounded-xl border border-indigo-100 bg-indigo-50/60">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1">Memória de cálculo</p>
                  <p className="text-xs text-indigo-900 whitespace-pre-wrap">{nextDeadline.calculation_memory}</p>
                </div>
              )}
            </>
          )}
        </section>

        {/* Prazos do processo */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Prazos do processo</h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                {process.process_deadlines.length}
              </span>
            </div>
            <Link href="/prazos" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
              Ver todos <ArrowUpRight size={13} />
            </Link>
          </div>
          {process.process_deadlines.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum prazo cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {process.process_deadlines.map((deadline: any) => {
                const isConfirmed = Boolean(deadline.confirmed_at)
                return (
                  <div key={deadline.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{deadline.description || 'Prazo processual'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(deadline.deadline_date)} · {deadline.business_days != null ? `${deadline.business_days} dias úteis` : 'contagem não informada'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        'px-2 py-1 rounded-lg text-[10px] font-bold',
                        isConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {isConfirmed ? 'Confirmado' : 'A confirmar'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingDeadline({ ...deadline, processNumber: process.number, clientName: process.client })}
                        title="Editar prazo"
                        className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingDeadline(toDeleteTarget(deadline))}
                        title="Excluir prazo"
                        className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-2 text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                      {!isConfirmed && (
                        <button
                          onClick={() => handleConfirm(deadline)}
                          disabled={confirmingId === deadline.id}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold hover:bg-indigo-100 disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Partes */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <User size={18} className="text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Partes</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">público</span>
          </div>
          {parties.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma parte cadastrada. Use a edição do processo para informar nome, papel e tipo.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {parties.map((party, index) => (
                <div key={`${party.name}-${index}`} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                    {party.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 break-words">{party.name}</p>
                    <p className="text-xs text-slate-500">{party.role}{party.type ? ` · ${party.type}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Linha do tempo unificada — DataJud + DJEN + prazos + notas */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <History size={18} className="text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Andamentos e publicações</h2>
            </div>
            <span className="text-[11px] text-slate-500">
              DataJud: {process.last_update?.includes('T') ? formatDateTime(process.last_update) : process.last_update || '—'}
            </span>
          </div>

          {timelineLoading && !unifiedTimeline ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <RefreshCw size={15} className="animate-spin" /> Montando a linha do tempo...
            </div>
          ) : unifiedTimeline ? (
            <ProcessTimeline
              timeline={unifiedTimeline}
              onRefresh={handleRefreshPublications}
              refreshing={refreshingPublications}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Não foi possível carregar a linha do tempo. Use “Sincronizar movimentações” para consultar o DataJud.
            </p>
          )}
        </section>

        <p className="text-center text-[11px] text-slate-400">
          Registro atualizado em {getTodayBR()} · Fonte: {process.source || 'Manual'}
        </p>
      </div>

      <DeadlineEditModal
        deadline={editingDeadline}
        lawyers={lawyers}
        userId={user?.id ?? null}
        source="processo"
        onClose={() => setEditingDeadline(null)}
        onSaved={load}
      />

      <DeleteDeadlineModal
        target={deletingDeadline}
        userId={user?.id ?? null}
        source="processos"
        onDeleted={load}
        onClose={() => setDeletingDeadline(null)}
      />
    </DashboardLayout>
  )
}

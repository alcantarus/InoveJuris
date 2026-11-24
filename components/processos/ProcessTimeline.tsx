'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Newspaper,
  RefreshCw,
  Scale,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import type { ProcessTimeline, TimelineItem, TimelineSource } from '@/lib/process-timeline'
import { cn } from '@/lib/utils'

type FilterKey = 'all' | 'official' | 'djen' | 'inferred' | 'manual'

interface ProcessTimelineProps {
  timeline: ProcessTimeline
  onRefresh?: () => void
  refreshing?: boolean
  cooldownSeconds?: number
  responsible?: string | null
  onCreateDeadline?: (publicationId: number) => void
}

const SOURCE_STYLE: Record<TimelineSource, { dot: string; chip: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  datajud: {
    dot: 'bg-indigo-500',
    chip: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    icon: Scale,
  },
  djen: {
    dot: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-700 ring-sky-100',
    icon: Newspaper,
  },
  deadline: {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    icon: Clock3,
  },
  manual: {
    dot: 'bg-slate-400',
    chip: 'bg-slate-100 text-slate-600 ring-slate-200',
    icon: UserRound,
  },
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(time))
}

function formatFullDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(time))
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return '—'
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(time))
}

function syncBadge(sync: ProcessTimeline['sync']): { label: string; tone: string; title: string } | null {
  if (!sync) return null
  const error = sync.error ? String(sync.error) : ''
  const title = [
    `Status: ${sync.status || 'desconhecido'}`,
    sync.lastSync ? `Última tentativa: ${formatClock(sync.lastSync)}` : null,
    error || null,
  ].filter(Boolean).join('\n')

  if (/429|limit/i.test(error)) {
    return { label: 'DataJud · cota 429', tone: 'bg-amber-400/15 text-amber-200 ring-amber-300/20', title }
  }
  if (sync.status && sync.status !== 'Sincronizado') {
    return { label: 'DataJud · indisponível', tone: 'bg-rose-400/15 text-rose-200 ring-rose-300/20', title }
  }
  return { label: 'DataJud · OK', tone: 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/20', title }
}

function dayKey(iso: string): string {
  const time = Date.parse(iso)
  return Number.isNaN(time) ? '' : new Date(time).toISOString().slice(0, 10)
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return null
  return Math.ceil((time - Date.now()) / (24 * 60 * 60 * 1000))
}

function matchesFilter(item: TimelineItem, filter: FilterKey): boolean {
  switch (filter) {
    case 'official':
      return item.official
    case 'djen':
      return item.source === 'djen'
    case 'inferred':
      return item.inferred != null
    case 'manual':
      return item.source === 'manual'
    default:
      return true
  }
}

export function ProcessTimeline({
  timeline,
  onRefresh,
  refreshing = false,
  cooldownSeconds = 0,
  responsible,
  onCreateDeadline,
}: ProcessTimelineProps) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const items = useMemo(
    () => timeline.items.filter((item) => {
      if (!matchesFilter(item, filter)) return false
      if (selectedDay && dayKey(item.date) !== selectedDay) return false
      return true
    }),
    [timeline.items, filter, selectedDay]
  )

  const activeDeadline = useMemo(() => {
    const candidates = timeline.items
      .filter((item) => item.deadline && daysUntil(item.deadline.date) != null && (daysUntil(item.deadline.date) as number) >= 0)
      .map((item) => ({ item, date: item.deadline!.date, days: daysUntil(item.deadline!.date) as number }))
      .sort((a, b) => a.days - b.days)
    return candidates[0] || null
  }, [timeline.items])

  const heat = useMemo(() => {
    const byDay = new Map<string, Set<TimelineSource>>()
    timeline.items.forEach((item) => {
      const key = dayKey(item.date)
      if (!key) return
      const set = byDay.get(key) || new Set<TimelineSource>()
      set.add(item.source)
      byDay.set(key, set)
    })

    const today = new Date()
    const days: Array<{ key: string; sources: TimelineSource[]; isToday: boolean }> = []
    for (let i = 29; i >= 0; i -= 1) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const key = date.toISOString().slice(0, 10)
      days.push({
        key,
        sources: Array.from(byDay.get(key) || []),
        isToday: i === 0,
      })
    }
    return days
  }, [timeline.items])

  const counts: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'all', label: 'Tudo', count: timeline.items.length },
    { key: 'official', label: 'Oficial', count: timeline.items.filter((item) => item.official).length },
    { key: 'djen', label: 'DJEN', count: timeline.stats.publications },
    { key: 'inferred', label: 'Inferido', count: timeline.items.filter((item) => item.inferred).length },
    { key: 'manual', label: 'Manual', count: timeline.stats.notes },
  ]

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(timeline.processNumber)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const progress = activeDeadline && activeDeadline.days <= 15
    ? Math.max(4, Math.round(((15 - activeDeadline.days) / 15) * 100))
    : 0

  const syncStatus = syncBadge(timeline.sync)
  const refreshDisabled = refreshing || cooldownSeconds > 0

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-5 text-white shadow-xl sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300">
              Processo monitorado
            </p>
            <h2 className="mt-1 break-all text-xl font-bold tracking-tight sm:text-2xl">
              {timeline.processNumber || 'Processo sem número'}
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              Linha do tempo unificada · {timeline.sources.length} fonte{timeline.sources.length === 1 ? '' : 's'}
            </p>
            {responsible && (
              <p className="mt-0.5 text-[11px] text-indigo-200">
                Responsável: {responsible}
              </p>
            )}
          </div>

          {activeDeadline && (
            <div className="flex shrink-0 items-center gap-4">
              <div
                className="grid h-[88px] w-[88px] place-items-center rounded-full shadow-lg"
                style={{
                  background: `conic-gradient(#34d399 0 ${progress}%, rgba(255,255,255,.14) ${progress}% 100%)`,
                }}
              >
                <div className="flex h-[70px] w-[70px] flex-col items-center justify-center rounded-full bg-[#111a33]">
                  <strong className="text-2xl leading-none">{activeDeadline.days}</strong>
                  <span className="mt-1 text-[9px] uppercase tracking-widest text-slate-400">dias</span>
                </div>
              </div>
              <div className="text-xs">
                <p className="font-semibold text-emerald-300">Prazo ativo</p>
                <p className="text-slate-300">{formatFullDate(activeDeadline.date)}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {activeDeadline.item.deadline?.official ? 'Confirmado' : 'Sugerido'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-300/20">
            ● Em andamento
          </span>
          {timeline.stats.lastMovementAt && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-200 ring-1 ring-white/10">
              Último andamento {formatDate(timeline.stats.lastMovementAt)}
            </span>
          )}
          {syncStatus && (
            <span
              title={syncStatus.title}
              className={cn('rounded-full px-3 py-1 text-[11px] font-semibold ring-1', syncStatus.tone)}
            >
              {syncStatus.label}
            </span>
          )}
          {timeline.stats.lastPublicationAt && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-slate-200 ring-1 ring-white/10">
              DJEN {formatDate(timeline.stats.lastPublicationAt)}
            </span>
          )}
          {timeline.degraded && (
            <span className="rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-300/20">
              Modo degradado
            </span>
          )}

          <div className="ml-auto flex flex-wrap gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshDisabled}
                title={cooldownSeconds > 0 ? `Aguarde ${cooldownSeconds}s para consultar o DJEN novamente` : 'Consulta apenas este CNJ no DJEN'}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={13} className={cn(refreshing && 'animate-spin')} />
                {refreshing
                  ? 'Atualizando...'
                  : cooldownSeconds > 0
                    ? `Aguarde ${cooldownSeconds}s`
                    : 'Atualizar publicações'}
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-[11px] font-bold text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
            >
              <Copy size={13} />
              {copied ? 'Copiado!' : 'Copiar nº'}
            </button>
          </div>
        </div>
      </div>

      {/* Mapa de 30 dias */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-semibold text-slate-800">Atividade dos últimos 30 dias</h3>
          <span className="text-[11px] text-slate-500">Cada cor é uma fonte confirmada</span>
        </div>
        <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-1">
          {heat.map((day) => {
            const primary = day.sources.includes('djen')
              ? 'djen'
              : day.sources.includes('datajud')
                ? 'datajud'
                : day.sources.includes('deadline')
                  ? 'deadline'
                  : day.sources.includes('manual')
                    ? 'manual'
                    : null

            return (
              <button
                key={day.key}
                type="button"
                aria-pressed={selectedDay === day.key}
                onClick={() => setSelectedDay((current) => current === day.key ? null : day.key)}
                title={`${formatFullDate(day.key)}${primary ? ` · ${primary}` : ''}${selectedDay === day.key ? ' · clicar para limpar' : ''}`}
                className={cn(
                  'h-5 rounded-[5px] border border-transparent bg-slate-100 transition-transform hover:scale-110',
                  primary === 'djen' && 'border-sky-200 bg-sky-200',
                  primary === 'datajud' && 'border-indigo-200 bg-indigo-200',
                  primary === 'deadline' && 'border-emerald-200 bg-emerald-200',
                  primary === 'manual' && 'border-slate-200 bg-slate-200',
                  day.isToday && 'ring-2 ring-slate-900',
                  selectedDay === day.key && 'ring-2 ring-indigo-500 ring-offset-1'
                )}
              />
            )
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-400">
          <span>{formatDate(heat[0]?.key)}</span>
          <span>hoje</span>
        </div>
      </div>

      {timeline.stats.pendingPublications > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[12px] text-sky-900">
          <span className="flex items-center gap-2">
            <Newspaper size={15} />
            <strong>{timeline.stats.pendingPublications} publicação(ões) a triar</strong>
            <span className="text-sky-700">— a importação não cria prazo sem sua confirmação.</span>
          </span>
          <Link
            href="/publicacoes"
            className="inline-flex items-center gap-1 font-bold text-sky-700 hover:underline"
          >
            Abrir fila <ExternalLink size={12} />
          </Link>
        </div>
      )}

      {timeline.degraded && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-[12.5px] font-semibold">
              {timeline.stale ? 'Movimentações em cache' : 'DataJud temporariamente indisponível'}
            </p>
            <p className="mt-0.5 text-[12px] text-amber-800">
              Publicações DJEN continuam sendo capturadas. Lacunas são sinalizadas; nenhum dado é inventado.
            </p>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h3 className="text-[15px] font-semibold text-slate-900">Linha do tempo unificada</h3>
          <div className="flex flex-wrap gap-1.5">
            {counts.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setFilter(entry.key)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[10.5px] font-bold transition-colors',
                  filter === entry.key
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                )}
              >
                {entry.label} <span className="opacity-70">{entry.count}</span>
              </button>
            ))}
            {selectedDay && (
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10.5px] font-bold text-indigo-700"
              >
                {formatDate(selectedDay)} <X size={11} />
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-5">
          {items.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              Nenhum evento encontrado para esse filtro.
            </p>
          )}

          {items.map((item, index) => {
            const style = SOURCE_STYLE[item.source]
            const Icon = item.inferred ? Sparkles : style.icon
            const isNewest = index === 0 && item.source === 'djen'
            const relatedOfficial = item.source === 'djen' && items.some((other) => {
              if (other.source !== 'datajud') return false
              const diff = Math.abs(Date.parse(other.date) - Date.parse(item.date))
              return diff <= 3 * 24 * 60 * 60 * 1000 &&
                `${other.title}`.toLowerCase().includes('senten') &&
                `${item.title} ${item.inferred?.label || ''}`.toLowerCase().includes('senten')
            })
            const publicationId = Number(item.meta.publication_id)
            const canCreateDeadline = Boolean(
              onCreateDeadline
              && item.source === 'djen'
              && Number.isInteger(publicationId)
              && publicationId > 0
              && item.meta.status === 'A triar'
              && !item.deadline?.official
            )

            return (
              <React.Fragment key={item.id}>
                {(index === 0 || dayKey(items[index - 1].date) !== dayKey(item.date)) && (
                  <p className="mb-2 mt-4 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 first:mt-0">
                    {formatDate(item.date)} {new Date(item.date).getUTCFullYear()}
                  </p>
                )}

                <article className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-3 pb-4">
                  {index < items.length - 1 && (
                    <span className="absolute left-[21px] top-11 bottom-0 w-0.5 bg-slate-100" />
                  )}
                  <div
                    className={cn(
                      'relative z-10 flex h-11 w-11 items-center justify-center rounded-xl border transition-transform hover:scale-105',
                      item.inferred
                        ? 'border-amber-200 bg-amber-50 text-amber-600'
                        : item.source === 'djen'
                          ? 'border-sky-200 bg-sky-50 text-sky-600'
                          : item.source === 'datajud'
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                            : item.source === 'deadline'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                              : 'border-slate-200 bg-slate-50 text-slate-500'
                    )}
                  >
                    <Icon size={19} />
                  </div>

                  <div
                    className={cn(
                      'rounded-xl border bg-slate-50/70 p-3.5 transition-all hover:-translate-y-px hover:shadow-md sm:p-4',
                      isNewest ? 'border-indigo-200 ring-4 ring-indigo-50' : 'border-slate-200'
                    )}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span
                        title={item.sourceLabel}
                        className={cn('rounded-md px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider ring-1', style.chip)}
                      >
                        {item.sourceLabel}
                      </span>
                      {isNewest && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                          Novo
                        </span>
                      )}
                      <span className="text-[11px] font-medium text-slate-500">{item.kind}</span>
                      <span className="ml-auto text-[11px] text-slate-400">{formatDate(item.date)}</span>
                    </div>

                    <h4 className="text-[14px] font-semibold text-slate-900">{item.title}</h4>
                    {item.description && (
                      <p className="mt-1 text-[12.5px] text-slate-600">{item.description}</p>
                    )}
                    {item.excerpt && (
                      <p className="mt-2 rounded-r-lg border-l-[3px] border-sky-200 bg-sky-50 px-3 py-2 text-[12px] italic text-sky-900">
                        “{item.excerpt}”
                      </p>
                    )}

                    {item.deadline && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
                        <Clock3 size={14} />
                        <span>
                          <strong>{item.deadline.label}</strong> · {formatFullDate(item.deadline.date)}
                        </span>
                        <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700">
                          {item.deadline.official ? 'Oficial' : 'Sugerido'}
                        </span>
                      </div>
                    )}

                    {item.inferred && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                        <Sparkles size={14} className="mt-0.5 shrink-0" />
                        <span>
                          <strong>{item.inferred.label}</strong> — confiança {item.inferred.confidence}.
                          Não é uma movimentação oficial.
                        </span>
                      </div>
                    )}

                    {relatedOfficial && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11.5px] text-indigo-800">
                        <Link2 size={14} className="mt-0.5 shrink-0" />
                        <span>
                          Este ato também aparece como movimentação DataJud. Os registros foram mantidos
                          separados, cada um com sua origem.
                        </span>
                      </div>
                    )}

                    {Object.keys(item.meta).length > 0 && (
                      <details className="mt-2.5">
                        <summary className="cursor-pointer list-none text-[11px] font-bold text-indigo-600">
                          <span className="mr-1">▸</span> Metadados da comunicação
                        </summary>
                        <pre className="mt-2 overflow-auto rounded-lg bg-slate-900 px-3 py-2.5 text-[10.5px] text-indigo-200">
{JSON.stringify({ external_id: item.externalId, ...item.meta }, null, 2)}
                        </pre>
                      </details>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-2.5 text-[11px] text-slate-400">
                      <span>{item.source === 'djen' ? 'Fonte: API pública CNJ' : `Fonte: ${item.source}`}</span>
                      <div className="flex flex-wrap items-center gap-3">
                        {canCreateDeadline && (
                          <button
                            type="button"
                            onClick={() => onCreateDeadline?.(publicationId)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-700"
                          >
                            <CalendarPlus size={12} /> Criar prazo
                          </button>
                        )}
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:underline"
                          >
                            Ver comunicação <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Rodapé de procedência */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11.5px] text-emerald-800">
        <span className="flex items-center gap-2">
          <CheckCircle2 size={15} />
          Publicação DJEN nunca é exibida como movimento DataJud. Lacunas e inferências aparecem com aviso.
        </span>
        <span className="flex items-center gap-1.5 text-emerald-700">
          <FileText size={13} /> Gerado em {formatFullDate(timeline.generatedAt)}
        </span>
      </div>
    </div>
  )
}

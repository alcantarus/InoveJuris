// Normalização da linha do tempo unificada do processo.
// Nenhuma fonte é "mascarada": movimentação vem de processes.history (DataJud),
// publicação vem de publications (DJEN) e prazo vem de process_deadlines.
// Este módulo é puro — sem acesso a banco ou rede — para ser reutilizado pela
// rota de leitura e pelo componente visual.

export type TimelineSource = 'datajud' | 'djen' | 'deadline' | 'manual'
export type TimelineKind = 'movement' | 'publication' | 'intimation' | 'deadline' | 'note'

export interface TimelineDeadlineInfo {
  date: string
  label: string
  official: boolean
}

export interface TimelineItem {
  id: string
  date: string
  source: TimelineSource
  sourceLabel: string
  kind: TimelineKind
  title: string
  description: string | null
  excerpt: string | null
  official: boolean
  externalId: string | null
  link: string | null
  deadline: TimelineDeadlineInfo | null
  inferred: { label: string; confidence: 'media' | 'alta' } | null
  meta: Record<string, unknown>
}

export interface ProcessTimelineSync {
  status: string | null
  lastSync: string | null
  error: string | null
}

export interface ProcessTimeline {
  processId: number
  processNumber: string
  generatedAt: string
  degraded: boolean
  stale: boolean
  sync: ProcessTimelineSync | null
  sources: TimelineSource[]
  items: TimelineItem[]
  stats: {
    movements: number
    publications: number
    pendingPublications: number
    deadlines: number
    notes: number
    activeDeadlines: number
    lastMovementAt: string | null
    lastPublicationAt: string | null
  }
}

function parseTime(value: unknown): number {
  if (value == null || value === '') return 0
  const raw = String(value)
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw
  const time = Date.parse(normalized)
  return Number.isNaN(time) ? 0 : time
}

function toIso(value: unknown): string | null {
  const time = parseTime(value)
  return time ? new Date(time).toISOString() : null
}

function stripHtml(value: unknown, max = 420): string | null {
  if (!value) return null
  const text = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.slice(0, max) : null
}

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>
    if (Array.isArray(candidate.movements)) return candidate.movements
    if (Array.isArray(candidate.history)) return candidate.history
  }
  return []
}

function addDays(dateIso: string, days: number): string | null {
  const time = parseTime(dateIso)
  if (!time || !Number.isFinite(days)) return null
  return new Date(time + days * 24 * 60 * 60 * 1000).toISOString()
}

function inferFromPublication(item: Record<string, unknown>): TimelineItem['inferred'] {
  const haystack = `${item.communication_type || ''} ${item.document_type || ''} ${stripHtml(item.content, 2000) || ''}`.toLowerCase()
  if (haystack.includes('senten')) {
    return { label: 'Possível sentença (inferida da publicação)', confidence: 'media' }
  }
  if (haystack.includes('despach')) {
    return { label: 'Possível despacho (inferido da publicação)', confidence: 'media' }
  }
  if (haystack.includes('decis')) {
    return { label: 'Possível decisão (inferida da publicação)', confidence: 'media' }
  }
  return null
}

export function normalizeHistory(history: unknown, processNumber: string): TimelineItem[] {
  return asArray(history).map((entry: any, index: number) => {
    const rawSource = typeof entry?.source === 'string' ? entry.source.toLowerCase() : 'datajud'
    const source: TimelineSource = rawSource === 'manual' ? 'manual' : 'datajud'
    const date = toIso(entry?.date || entry?.dataHora || entry?.data || entry?.created_at)
    const description = String(entry?.description || entry?.nome || entry?.movimentoNacional?.nome || 'Movimentação registrada')
    const externalId = entry?.external_id
      ? String(entry.external_id)
      : `history:${processNumber}:${index}:${date || 'sem-data'}:${description}`

    return {
      id: `${source}:${externalId}`,
      date: date || new Date(0).toISOString(),
      source,
      sourceLabel: source === 'manual' ? 'Manual · interno' : 'DataJud · movimentação',
      kind: source === 'manual' ? 'note' : 'movement',
      title: description,
      description: entry?.complemento ? String(entry.complemento) : null,
      excerpt: null,
      official: source === 'datajud',
      externalId,
      link: null,
      deadline: null,
      inferred: null,
      meta: {
        ...(entry?.codigo ? { codigo: entry.codigo } : {}),
        ...(entry?.movimentoLocal?.nome ? { movimentoLocal: entry.movimentoLocal.nome } : {}),
      },
    }
  })
}

export function normalizePublications(
  publications: any[],
  deadlinesById: Map<number, any> = new Map()
): TimelineItem[] {
  return publications.map((item: any) => {
    const date = toIso(item?.publication_date)
    const type = String(item?.communication_type || item?.document_type || '').toLowerCase()
    const kind: TimelineKind = type.includes('intima') ? 'intimation' : 'publication'
    const title = kind === 'intimation'
      ? 'Intimação publicada no DJEN'
      : 'Publicação no DJEN'

    const externalId = item?.external_id ? String(item.external_id) : null
    const linkedDeadline = item?.deadline_id ? deadlinesById.get(Number(item.deadline_id)) : null
    let deadline: TimelineItem['deadline'] = null

    if (linkedDeadline?.deadline_date) {
      deadline = {
        date: toIso(linkedDeadline.deadline_date) || String(linkedDeadline.deadline_date),
        label: `Prazo: ${linkedDeadline.description || 'Prazo processual'}`,
        official: true,
      }
    } else if (item?.suggested_days != null && date) {
      const suggestedDate = addDays(date, Number(item.suggested_days))
      if (suggestedDate) {
        deadline = {
          date: suggestedDate,
          label: `Prazo sugerido (${item.suggested_days} dias)`,
          official: false,
        }
      }
    }

    const details = [item?.unit ? `Órgão: ${item.unit}` : null, item?.communication_number ? `Comunicação nº ${item.communication_number}` : null]
      .filter(Boolean)
      .join(' · ')

    return {
      id: `djen:${externalId || item?.id || date || 'sem-id'}`,
      date: date || new Date(0).toISOString(),
      source: 'djen',
      sourceLabel: 'DJEN · publicação',
      kind,
      title,
      description: details || null,
      excerpt: stripHtml(item?.content),
      official: false,
      externalId,
      link: item?.link ? String(item.link) : null,
      deadline,
      inferred: inferFromPublication(item || {}),
      meta: {
        publication_id: item?.id ?? null,
        external_id: externalId,
        communication_number: item?.communication_number ?? null,
        communication_type: item?.communication_type ?? null,
        document_type: item?.document_type ?? null,
        suggested_days: item?.suggested_days ?? null,
        status: item?.status ?? null,
      },
    }
  })
}

export function normalizeDeadlines(deadlines: any[]): TimelineItem[] {
  return deadlines.map((item: any) => {
    const date = toIso(item?.deadline_date)
    return {
      id: `deadline:${item?.id || date || 'sem-id'}`,
      date: date || new Date(0).toISOString(),
      source: 'deadline',
      sourceLabel: 'Prazo · confirmado',
      kind: 'deadline',
      title: `Prazo: ${item?.description || 'Prazo processual'}`,
      description: item?.status ? `Situação: ${item.status}` : null,
      excerpt: null,
      official: true,
      externalId: item?.id != null ? String(item.id) : null,
      link: null,
      deadline: date ? { date, label: 'Vencimento', official: true } : null,
      inferred: null,
      meta: { deadline_id: item?.id ?? null, status: item?.status ?? null },
    }
  })
}

interface BuildTimelineOptions {
  processId: number
  processNumber: string
  history: unknown
  publications: any[]
  deadlines: any[]
  degraded?: boolean
  stale?: boolean
  sync?: ProcessTimelineSync | null
  now?: Date
}

export function buildProcessTimeline(options: BuildTimelineOptions): ProcessTimeline {
  const now = options.now || new Date()
  const deadlinesById = new Map<number, any>()
  const linkedDeadlineIds = new Set<number>()
  ;(options.deadlines || []).forEach((item: any) => {
    if (item?.id == null) return
    deadlinesById.set(Number(item.id), item)
  })
  ;(options.publications || []).forEach((item: any) => {
    if (item?.deadline_id != null) linkedDeadlineIds.add(Number(item.deadline_id))
  })

  const unlinkedDeadlines = (options.deadlines || []).filter(
    (item: any) => item?.id == null || !linkedDeadlineIds.has(Number(item.id))
  )

  const all = [
    ...normalizeHistory(options.history, options.processNumber),
    ...normalizePublications(options.publications, deadlinesById),
    ...normalizeDeadlines(unlinkedDeadlines),
  ]

  const seen = new Set<string>()
  const items = all
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .sort((a, b) => parseTime(b.date) - parseTime(a.date))

  const sources = Array.from(new Set(items.map((item) => item.source))).sort()
  const nowTime = now.getTime()
  const activeDeadlines = items.filter((item) => {
    if (!item.deadline?.date) return false
    return parseTime(item.deadline.date) >= nowTime
  }).length

  return {
    processId: options.processId,
    processNumber: options.processNumber,
    generatedAt: now.toISOString(),
    degraded: options.degraded === true,
    stale: options.stale === true,
    sync: options.sync || null,
    sources,
    items,
    stats: {
      movements: items.filter((item) => item.source === 'datajud').length,
      publications: items.filter((item) => item.source === 'djen').length,
      pendingPublications: (options.publications || []).filter(
        (item: any) => item?.status === 'A triar'
      ).length,
      deadlines: items.filter((item) => item.kind === 'deadline').length,
      notes: items.filter((item) => item.source === 'manual').length,
      activeDeadlines,
      lastMovementAt: items.find((item) => item.source === 'datajud')?.date || null,
      lastPublicationAt: items.find((item) => item.source === 'djen')?.date || null,
    },
  }
}

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatDate, normalizeSearchText } from '@/lib/utils'

export type PublicationStatus = 'A triar' | 'Triada' | 'Ignorada' | 'Arquivada'

export const PUBLICATION_STATUSES: PublicationStatus[] = ['A triar', 'Triada', 'Ignorada', 'Arquivada']

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  'A triar': 'A triar',
  Triada: 'Triada',
  Ignorada: 'Ignorada',
  Arquivada: 'Arquivada',
}

export interface PublicationRecipient {
  name: string
  role?: string
  lawyer?: string
  oab?: string
  ufOab?: string
}

export interface PublicationItem {
  id: number
  source: string
  externalId: string | null
  processNumber: string
  processNumberRaw: string | null
  processId: number | null
  clientName: string
  court: string | null
  unit: string | null
  publicationDate: string | null
  page: string | null
  communicationNumber: number | null
  chamber: string | null
  importance: string | null
  suggestedDays: number | null
  content: string | null
  link: string | null
  documentType: string | null
  communicationType: string | null
  recipients: PublicationRecipient[]
  status: PublicationStatus
  decision: string | null
  decisionNotes: string | null
  responsibleId: number | null
  responsibleName: string
  reviewedBy: number | null
  reviewedAt: string | null
  readAt: string | null
  deadlineId: number | null
  syncedAt: string | null
}

export interface PublicationProcessOption {
  id: number
  number: string
  client: string
}

export interface PublicationLawyerOption {
  id: number
  name: string
}

export interface PublicationsPayload {
  items: PublicationItem[]
  processes: PublicationProcessOption[]
  lawyers: PublicationLawyerOption[]
  error: string | null
}

function asStatus(value: unknown): PublicationStatus {
  const text = String(value || '').toLowerCase()
  if (text.startsWith('triad')) return 'Triada'
  if (text.startsWith('ignor')) return 'Ignorada'
  if (text.startsWith('arquiv')) return 'Arquivada'
  return 'A triar'
}

function displayNumber(row: any, fallback?: string): string {
  return String(
    row?.process_number_masked ||
    (row?.process_number ? formatCnj(row.process_number) : '') ||
    fallback ||
    ''
  ).trim()
}

function formatCnj(value: string): string {
  const digits = String(value).replace(/\D/g, '')
  if (digits.length !== 20) return String(value)
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`
}

export async function fetchPublications(): Promise<PublicationsPayload> {
  if (!isSupabaseConfigured) {
    return { items: [], processes: [], lawyers: [], error: null }
  }

  const [publicationsRes, processesRes, lawyersRes] = await Promise.all([
    supabase.from('publications').select('*').order('publication_date', { ascending: false }).limit(1500),
    supabase.from('processes').select('id, number, client, lawyer_id').limit(10000),
    supabase.from('lawyers').select('id, name').limit(1000),
  ])

  const error = publicationsRes.error || processesRes.error || lawyersRes.error
  const message = error ? (error.message || String(error)) : null

  const processes = (processesRes.data || []) as any[]
  const lawyers = (lawyersRes.data || []) as any[]
  const processById = new Map<number, any>(processes.map((p: any) => [Number(p.id), p]))
  const lawyerById = new Map<number, any>(lawyers.map((l: any) => [Number(l.id), l]))

  const processOptions: PublicationProcessOption[] = processes
    .map((p: any) => ({
      id: Number(p.id),
      number: String(p.number || ''),
      client: String(p.client || ''),
    }))
    .filter((p: any) => Number.isFinite(p.id) && p.id > 0)
    .sort((a, b) => a.number.localeCompare(b.number, 'pt-BR'))

  const items: PublicationItem[] = ((publicationsRes.data || []) as any[]).map((p: any) => {
    const process = p.process_id != null ? processById.get(Number(p.process_id)) : undefined
    const responsibleId = p.responsible_id != null
      ? Number(p.responsible_id)
      : process?.lawyer_id != null
        ? Number(process.lawyer_id)
        : null
    const lawyer = responsibleId != null ? lawyerById.get(responsibleId) : undefined
    const recipients: PublicationRecipient[] = Array.isArray(p.recipients) ? p.recipients : []

    return {
      id: Number(p.id),
      source: String(p.source || 'DJEN'),
      externalId: p.external_id != null ? String(p.external_id) : null,
      processNumber: displayNumber(p, process?.number),
      processNumberRaw: p.process_number != null ? String(p.process_number) : null,
      processId: p.process_id != null ? Number(p.process_id) : null,
      clientName: String(process?.client || ''),
      court: p.court || null,
      unit: p.unit || null,
      publicationDate: p.publication_date ? String(p.publication_date).slice(0, 10) : null,
      page: p.page != null ? String(p.page) : null,
      communicationNumber: p.communication_number != null ? Number(p.communication_number) : null,
      chamber: p.chamber || null,
      importance: p.importance || null,
      suggestedDays: p.suggested_days != null ? Number(p.suggested_days) : null,
      content: p.content || null,
      link: p.link || null,
      documentType: p.document_type || null,
      communicationType: p.communication_type || null,
      recipients,
      status: asStatus(p.status),
      decision: p.decision || null,
      decisionNotes: p.decision_notes || null,
      responsibleId,
      responsibleName: lawyer?.name || 'Não atribuído',
      reviewedBy: p.reviewed_by != null ? Number(p.reviewed_by) : null,
      reviewedAt: p.reviewed_at || null,
      readAt: p.read_at || null,
      deadlineId: p.deadline_id != null ? Number(p.deadline_id) : null,
      syncedAt: p.synced_at || null,
    }
  })

  return {
    items,
    processes: processOptions,
    lawyers: lawyers.map((l: any) => ({ id: Number(l.id), name: String(l.name || '') })),
    error: message,
  }
}

export function countPublicationStatuses(items: PublicationItem[]): Record<PublicationStatus, number> {
  return items.reduce(
    (acc, item) => {
      acc[item.status] += 1
      return acc
    },
    { 'A triar': 0, Triada: 0, Ignorada: 0, Arquivada: 0 } as Record<PublicationStatus, number>
  )
}

/** Sugere dias úteis a partir do texto. Nunca substitui a confirmação do advogado. */
export function suggestDeadlineDays(content: string | null | undefined): number | null {
  if (!content) return null
  const text = normalizeSearchText(content)

  const hours = text.match(/(\d+)\s*(?:\([^)]*\)\s*)?horas?/)
  if (hours) {
    const value = Math.ceil(Number(hours[1]) / 24)
    return Math.min(Math.max(value, 1), 60)
  }

  const days = text.match(/(\d+)\s*(?:\([^)]*\)\s*)?dias?/)
  if (days) {
    return Math.min(Math.max(Number(days[1]), 1), 60)
  }

  return null
}

function toYmd(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Contagem sugerida de dias úteis, desconsiderando apenas fins de semana. */
export function addBusinessDays(startDate: string, days: number): string {
  const date = new Date(`${String(startDate).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return startDate

  let remaining = Math.max(1, Math.floor(days))
  while (remaining > 0) {
    date.setDate(date.getDate() + 1)
    const weekday = date.getDay()
    if (weekday !== 0 && weekday !== 6) remaining -= 1
  }
  return toYmd(date)
}

export function buildCalculationMemory(
  publicationDate: string | null,
  days: number,
  deadlineDate: string,
  source: string
): string {
  const base = publicationDate ? formatDate(publicationDate) : 'data de disponibilização não informada'
  return [
    `Sugestão gerada a partir de publicação ${source}, disponibilizada em ${base}.`,
    `Contagem de ${days} dia(s) úteis considerando apenas fins de semana (sem feriados nem recessos forenses).`,
    `Vencimento sugerido: ${formatDate(deadlineDate)}.`,
    'Data revisada e confirmada expressamente pelo advogado responsável antes da criação do prazo.',
  ].join(' ')
}

export function exportPublicationsCsv(items: PublicationItem[], filename?: string): void {
  const header = [
    'Fonte', 'CNJ', 'Tribunal', 'Órgão/Unidade', 'Disponibilização', 'Câmara',
    'Página', 'Importância', 'Advogado responsável', 'Situação', 'Decisão', 'Observações',
  ]
  const rows = items.map(item => [
    item.source,
    item.processNumber,
    item.court || '',
    item.unit || '',
    item.publicationDate ? formatDate(item.publicationDate) : '',
    item.chamber || '',
    item.page || '',
    item.importance || '',
    item.responsibleName,
    item.status,
    item.decision || '',
    item.decisionNotes || '',
  ])
  const content = [header, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'publicacoes.csv'
  link.click()
  URL.revokeObjectURL(url)
}

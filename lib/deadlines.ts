import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getTodayBR, normalizeSearchText } from '@/lib/utils'

export type DeadlineBucket = 'vencidos' | 'hoje' | '7dias' | '30dias' | 'aberto' | 'concluido'

export interface DeadlineItem {
  id: string | number
  process_id: number | null
  processNumber: string
  clientName: string
  description: string
  deadlineDate: string
  daysRemaining: number
  status: string
  bucket: DeadlineBucket
  priority: string
  responsible: string
  area: string
  court: string
}

export interface ProcessOption {
  id: number
  number: string
  client: string
}

export interface DeadlinesPayload {
  items: DeadlineItem[]
  processOptions: ProcessOption[]
  lawyers: any[]
  error: string | null
}

const CONCLUDED_STATUSES = ['concluido', 'concluído', 'finalizado', 'baixado', 'cancelado', 'done', 'quitado']

export function daysUntil(date: string | null | undefined): number {
  if (!date) return 0
  const today = new Date(`${getTodayBR()}T00:00:00`)
  const target = new Date(`${String(date).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(target.getTime())) return 0
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function toBucket(daysRemaining: number, status: string | null | undefined): DeadlineBucket {
  if (CONCLUDED_STATUSES.includes(normalizeSearchText(status))) return 'concluido'
  if (daysRemaining < 0) return 'vencidos'
  if (daysRemaining === 0) return 'hoje'
  if (daysRemaining <= 7) return '7dias'
  if (daysRemaining <= 30) return '30dias'
  return 'aberto'
}

export const BUCKET_LABELS: Record<DeadlineBucket, string> = {
  vencidos: 'Vencidos',
  hoje: 'Hoje',
  '7dias': 'Próximos 7 dias',
  '30dias': 'Próximos 30 dias',
  aberto: 'Em aberto',
  concluido: 'Concluídos',
}

export async function fetchDeadlines(): Promise<DeadlinesPayload> {
  if (!isSupabaseConfigured) {
    return { items: [], processOptions: [], lawyers: [], error: null }
  }

  const [deadlinesRes, processesRes, contractsRes, clientsRes, lawyersRes] = await Promise.all([
    supabase.from('process_deadlines').select('*'),
    supabase.from('processes').select('id, number, client, court, type, status, priority, lawyer_id'),
    supabase.from('contracts').select('processNumber, client_id'),
    supabase.from('clients').select('id, name'),
    supabase.from('lawyers').select('id, name, users:user_id(name)'),
  ])

  const error = deadlinesRes.error || processesRes.error || contractsRes.error || clientsRes.error || lawyersRes.error
  const message = error ? (error.message || String(error)) : null

  const processes = processesRes.data || []
  const contracts = contractsRes.data || []
  const clients = clientsRes.data || []
  const lawyers = lawyersRes.data || []

  const processById = new Map<number, any>(processes.map((p: any) => [Number(p.id), p]))
  const contractByNumber = new Map<string, any>(
    contracts
      .filter((c: any) => c.processNumber != null)
      .map((c: any) => [String(c.processNumber), c])
  )
  const clientById = new Map<number, any>(clients.map((c: any) => [Number(c.id), c]))
  const lawyerById = new Map<number, any>(lawyers.map((l: any) => [Number(l.id), l]))

  const items: DeadlineItem[] = ((deadlinesRes.data || []) as any[]).map((d: any) => {
    const process = d.process_id != null ? processById.get(Number(d.process_id)) : undefined
    const contract = process ? contractByNumber.get(String(process.number)) : undefined
    const client = contract ? clientById.get(Number(contract.client_id)) : undefined
    const lawyer = process?.lawyer_id != null ? lawyerById.get(Number(process.lawyer_id)) : undefined
    const days = daysUntil(d.deadline_date)

    const lawyerName = lawyer
      ? (lawyer.name || lawyer.users?.name || 'Advogado')
      : 'Não atribuído'

    return {
      id: d.id,
      process_id: d.process_id ?? null,
      processNumber: process?.number || 'Sem número',
      clientName: client?.name || process?.client || 'Cliente não informado',
      description: d.description || 'Prazo processual',
      deadlineDate: d.deadline_date,
      daysRemaining: days,
      status: d.status || 'Pendente',
      bucket: toBucket(days, d.status),
      priority: process?.priority || (days <= 1 ? 'Alta' : 'Média'),
      responsible: lawyerName,
      area: process?.type || 'Não informada',
      court: process?.court || '—',
    }
  }).sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate))

  const processOptions: ProcessOption[] = processes.map((p: any) => ({
    id: Number(p.id),
    number: p.number || 'Sem número',
    client: p.client || 'Cliente não informado',
  }))

  return { items, processOptions, lawyers, error: message }
}

export function countBuckets(items: DeadlineItem[]): Record<DeadlineBucket, number> {
  return items.reduce(
    (acc, item) => {
      acc[item.bucket] += 1
      return acc
    },
    { vencidos: 0, hoje: 0, '7dias': 0, '30dias': 0, aberto: 0, concluido: 0 } as Record<DeadlineBucket, number>
  )
}

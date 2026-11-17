import { getTodayBR, normalizeSearchText } from '@/lib/utils'

export const INACTIVE_PROCESS_STATUSES = ['arquivado', 'concluído', 'concluido', 'baixado', 'encerrado', 'cancelado']

export function isActiveProcess(status: string | null | undefined): boolean {
  return !INACTIVE_PROCESS_STATUSES.includes(normalizeSearchText(status))
}

export function getNextDeadline(process: any): any | null {
  const deadlines = Array.isArray(process?.process_deadlines) ? process.process_deadlines : []
  if (deadlines.length === 0) return null
  return deadlines
    .filter((d: any) => Boolean(d?.deadline_date))
    .slice()
    .sort((a: any, b: any) => String(a.deadline_date).localeCompare(String(b.deadline_date)))[0] || null
}

export function daysUntilDate(date: string | null | undefined): number {
  if (!date) return Number.POSITIVE_INFINITY
  const today = new Date(`${getTodayBR()}T00:00:00`)
  const target = new Date(`${String(date).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function getResponsibleName(process: any, lawyers: any[] = []): string {
  if (process?.responsible_name) return process.responsible_name
  if (process?.lawyer_id != null) {
    const lawyer = lawyers.find(l => Number(l.id) === Number(process.lawyer_id))
    if (lawyer) return lawyer.name || lawyer.users?.name || 'Advogado'
    if (process?.lawyers) return process.lawyers.name || process.lawyers.users?.name || 'Advogado'
  }
  return 'Não atribuído'
}

export function normalizeParties(value: unknown): Array<{ name: string; role: string; type: string }> {
  if (Array.isArray(value)) {
    return value
      .filter((p: any) => p && (p.name || p.nome))
      .map((p: any) => ({
        name: String(p.name || p.nome || ''),
        role: String(p.role || p.papel || 'Parte'),
        type: String(p.type || p.tipo || ''),
      }))
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return normalizeParties(parsed)
    } catch {
      return [{ name: value, role: 'Parte', type: '' }]
    }
  }
  return []
}

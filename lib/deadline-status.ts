import { normalizeSearchText } from '@/lib/utils'

/** Situações que encerram o prazo. 'Confirmado' NÃO encerra: é apenas a ciência do advogado. */
export const CONCLUDED_DEADLINE_STATUSES = [
  'concluido',
  'concluído',
  'finalizado',
  'baixado',
  'cancelado',
  'done',
  'quitado',
]

export function isConcludedDeadlineStatus(status: string | null | undefined): boolean {
  return CONCLUDED_DEADLINE_STATUSES.includes(normalizeSearchText(status))
}

export const DEADLINE_STATUS_OPTIONS = ['Pendente', 'Em andamento', 'Concluído', 'Cancelado']

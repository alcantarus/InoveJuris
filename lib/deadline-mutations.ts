// Ponto único de mutação de prazos. Todas as telas (Processos, Prazos e
// Calendário) usam estas funções, que por sua vez chamam RPCs transacionais no
// banco — histórico, validação da justificativa e reabertura da confirmação.

import { supabase } from '@/lib/supabase'
import { getAppEnv } from '@/lib/env'

export interface DeadlineEditTarget {
  id: string | number
  process_id?: number | null
  processNumber?: string
  clientName?: string
  deadlineDate: string
  description?: string | null
  status?: string | null
  responsibleId?: number | null
  businessDays?: number | null
  calculationMemory?: string | null
  confirmedAt?: string | null
  notificationDate?: string | null
  publicationDate?: string | null
  countStartDate?: string | null
}

export interface DeadlineDateTime {
  date: string
  time: string
}

/** Converte o valor gravado no banco (date ou timestamptz) para os inputs. */
export function splitDeadlineDateTime(value: string | null | undefined): DeadlineDateTime {
  const raw = String(value || '')
  const date = raw.slice(0, 10)
  const rest = raw.length > 10 ? raw.slice(11, 16) : ''
  return { date, time: /^\d{2}:\d{2}$/.test(rest) ? rest : '' }
}

/** Monta o valor aceito pela RPC: yyyy-mm-dd ou yyyy-mm-ddThh:mm:ss. */
export function combineDeadlineDateTime(date: string, time?: string): string {
  const cleanDate = String(date || '').slice(0, 10)
  const cleanTime = String(time || '').slice(0, 5)
  return /^\d{2}:\d{2}$/.test(cleanTime) ? `${cleanDate}T${cleanTime}:00` : cleanDate
}

interface CreateInput {
  processId: number
  deadlineDate: string
  description: string
  responsibleId?: number | null
  businessDays?: number | null
  calculationMemory?: string | null
  userId?: number | null
  source?: string
}

interface UpdateInput {
  deadline: DeadlineEditTarget
  deadlineDate: string
  description: string
  status: string
  responsibleId?: number | null
  justification?: string
  userId?: number | null
  source?: string
}

function rpcError(error: any, fallback: string): string {
  return error?.message ? `${fallback} ${error.message}` : fallback
}

export async function createDeadlineRecord(input: CreateInput): Promise<{ id?: number; error?: string }> {
  const { data, error } = await supabase.rpc('create_process_deadline', {
    p_process_id: input.processId,
    p_deadline_at: input.deadlineDate,
    p_description: input.description.trim(),
    p_responsible_id: input.responsibleId ?? null,
    p_business_days: input.businessDays ?? null,
    p_calculation_memory: input.calculationMemory ?? null,
    p_environment: getAppEnv(),
    p_created_by: input.userId ?? null,
    p_source: input.source || 'prazos',
  })

  if (error) return { error: rpcError(error, 'Não foi possível criar o prazo.') }
  return { id: (data as any)?.id != null ? Number((data as any).id) : undefined }
}

export async function updateDeadlineRecord(input: UpdateInput): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('update_process_deadline', {
    p_id: Number(input.deadline.id),
    p_environment: getAppEnv(),
    p_deadline_at: input.deadlineDate,
    p_description: input.description.trim(),
    p_status: input.status,
    p_responsible_id: input.responsibleId ?? null,
    p_justification: input.justification ?? null,
    p_edited_by: input.userId ?? null,
    p_source: input.source || 'prazos',
  })

  return error ? { error: rpcError(error, 'Não foi possível salvar o prazo.') } : {}
}

export async function confirmDeadlineRecord(
  deadlineId: string | number,
  userId?: number | null
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('confirm_process_deadline', {
    p_id: Number(deadlineId),
    p_environment: getAppEnv(),
    p_edited_by: userId ?? null,
  })

  return error ? { error: rpcError(error, 'Não foi possível confirmar o prazo.') } : {}
}

export async function deleteDeadlineRecord(
  deadlineId: string | number,
  reason: string,
  userId?: number | null,
  source = 'processos'
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('delete_process_deadline', {
    p_id: Number(deadlineId),
    p_environment: getAppEnv(),
    p_edited_by: userId ?? null,
    p_reason: reason,
    p_source: source,
  })

  return error ? { error: rpcError(error, 'Não foi possível excluir o prazo.') } : {}
}

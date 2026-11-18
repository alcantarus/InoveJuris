// Vínculos de representação legal de menores. O responsável é outro registro
// de clients — nunca um nome copiado dentro do cadastro do menor.

import { supabase } from '@/lib/supabase'
import { getAppEnv, type AppEnv } from '@/lib/env'

export type RelationshipType = 'pai' | 'mae' | 'tutor' | 'curador' | 'outro'

export interface GuardianLink {
  id?: number
  related_client_id: number
  guardian_name?: string | null
  guardian_document?: string | null
  relationship_type: RelationshipType
  relationship_label: string
  guardianship_type?: string | null
  is_primary: boolean
  valid_from?: string | null
  valid_until?: string | null
}

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  pai: 'Pai',
  mae: 'Mãe',
  tutor: 'Tutor',
  curador: 'Curador',
  outro: 'Outro',
}

export const RELATIONSHIP_TEXT: Record<RelationshipType, string> = {
  pai: 'pai',
  mae: 'mãe',
  tutor: 'tutor',
  curador: 'curador',
  outro: 'responsável legal',
}

export function normalizeGuardianLink(link: GuardianLink): GuardianLink {
  return {
    ...link,
    related_client_id: Number(link.related_client_id),
    relationship_label: String(link.relationship_label || RELATIONSHIP_TEXT[link.relationship_type] || 'responsável legal'),
    guardianship_type: link.guardianship_type || null,
    valid_from: link.valid_from || null,
    valid_until: link.valid_until || null,
  }
}

/** Carrega os vínculos dos clientes visíveis na página, agrupados por cliente. */
export async function fetchGuardiansForClients(
  clientIds: number[],
  env: AppEnv = getAppEnv()
): Promise<Map<number, GuardianLink[]>> {
  const result = new Map<number, GuardianLink[]>()
  if (!clientIds.length) return result

  const { data, error } = await supabase
    .from('v_client_guardians')
    .select('*')
    .eq('environment', env)
    .in('client_id', clientIds)

  if (error) {
    // Não quebra a lista de clientes se a migration ainda não tiver sido
    // aplicada no ambiente; o texto legado continua visível.
    console.error('Erro ao carregar responsáveis legais:', error.message || error)
    return result
  }

  for (const row of data || []) {
    const link = normalizeGuardianLink({
      id: row.relationship_id,
      related_client_id: row.guardian_id,
      guardian_name: row.guardian_name,
      guardian_document: row.guardian_document,
      relationship_type: row.relationship_type as RelationshipType,
      relationship_label: row.relationship_label,
      guardianship_type: row.guardianship_type,
      is_primary: Boolean(row.is_primary),
      valid_from: row.valid_from,
      valid_until: row.valid_until,
    })
    const list = result.get(row.client_id) || []
    list.push(link)
    result.set(row.client_id, list.sort((a, b) => Number(b.is_primary) - Number(a.is_primary)))
  }

  return result
}

/** Substitui os vínculos de um menor pela RPC transacional. */
export async function saveClientGuardians(
  clientId: number,
  guardians: GuardianLink[],
  env: AppEnv = getAppEnv(),
  editedBy?: number | null
): Promise<{ error: string | null }> {
  const payload = guardians.map(link => ({
    related_client_id: Number(link.related_client_id),
    relationship_type: link.relationship_type,
    relationship_label: link.relationship_label,
    guardianship_type: link.guardianship_type || null,
    is_primary: Boolean(link.is_primary),
    valid_from: link.valid_from || null,
    valid_until: link.valid_until || null,
  }))

  const { error } = await supabase.rpc('save_client_guardians', {
    p_client_id: clientId,
    p_environment: env,
    p_guardians: payload,
    p_edited_by: editedBy ?? null,
  })

  return { error: error ? (error.message || String(error)) : null }
}

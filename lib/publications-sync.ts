// Payload de gravação de publicações — somente campos de fonte.
// Status, decisão, responsável, leitura, prazo e importância ficam sob controle
// humano. Esta regra é a mesma usada pelo sync amplo em /api/djen-sync.

import type { NormalizedPublication } from '@/lib/djen'

export function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size))
  return result
}

export function buildPublicationUpsert(
  item: NormalizedPublication,
  environment: string,
  processId: number | null,
  now: string
) {
  return {
    source: 'DJEN',
    external_id: item.external_id,
    environment,
    process_number: item.process_number,
    process_number_masked: item.process_number_masked,
    process_id: processId,
    court: item.court,
    unit: item.unit,
    publication_date: item.publication_date,
    page: item.page,
    communication_number: item.communication_number,
    chamber: item.chamber,
    content: item.content,
    link: item.link,
    document_type: item.document_type,
    communication_type: item.communication_type,
    recipients: item.recipients,
    raw_payload: item.raw_payload,
    synced_at: item.synced_at,
    updated_at: now,
  }
}

export async function upsertPublications(
  client: any,
  items: NormalizedPublication[],
  environment: string,
  processId: number | null,
  now: string
): Promise<void> {
  const payload = items.map((item) => buildPublicationUpsert(item, environment, processId, now))
  for (const group of chunk(payload, 200)) {
    const { error } = await client
      .from('publications')
      .upsert(group, { onConflict: 'source,external_id,environment' })
    if (error) throw error
  }
}

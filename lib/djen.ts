// Cliente da API pública do DJEN (Diário de Justiça Eletrônico Nacional).
// Documentação oficial: https://comunicaapi.pje.jus.br/swagger/index.html
// Endpoint consultado: GET https://comunicaapi.pje.jus.br/api/v1/comunicacao
// Leitura pública, sem token. Escrita é exclusiva dos tribunais.

export const DJEN_API_URL = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'

export interface DjenSyncFilters {
  /** yyyy-mm-dd */
  startDate: string
  /** yyyy-mm-dd */
  endDate: string
  tribunal?: string
  processNumber?: string
  oab?: string
  ufOab?: string
  lawyerName?: string
  partyName?: string
  communicationNumber?: number
  page: number
  /** A API aceita somente 5 ou 100. */
  pageSize: 5 | 100
  /** Limite de páginas por sincronização para respeitar o rate limit. */
  maxPages: number
}

export interface DjenRecipient {
  nome?: string
  polo?: string
  comunicacao_id?: number
}

export interface DjenLawyerRecipient {
  advogado?: {
    nome?: string
    numero_oab?: string
    uf_oab?: string
  }
}

export interface DjenCommunication {
  id: number | string
  data_disponibilizacao?: string
  datadisponibilizacao?: string
  siglaTribunal?: string
  tipoComunicacao?: string
  nomeOrgao?: string
  texto?: string
  numero_processo?: string
  meio?: string
  meiocompleto?: string
  link?: string
  tipoDocumento?: string
  nomeClasse?: string
  codigoClasse?: string
  numeroComunicacao?: number
  ativo?: boolean
  hash?: string
  numeroprocessocommascara?: string
  pagina?: string | number
  destinatarios?: DjenRecipient[]
  destinatarioadvogados?: DjenLawyerRecipient[]
  [key: string]: any
}

export interface DjenResponse {
  status: string
  message?: string
  count: number
  items: DjenCommunication[]
}

export interface DjenFetchResult {
  items: DjenCommunication[]
  /** Total informado pela API (limitado a 10.000 resultados). */
  total: number
  pagesFetched: number
  rateLimitRemaining: number | null
}

export interface NormalizedPublication {
  source: 'DJEN'
  external_id: string
  process_number: string | null
  process_number_masked: string | null
  court: string | null
  unit: string | null
  publication_date: string | null
  page: string | null
  communication_number: number | null
  chamber: string
  importance: null
  suggested_days: null
  content: string | null
  link: string | null
  document_type: string | null
  communication_type: string | null
  recipients: Array<{ name: string; role?: string; lawyer?: string; oab?: string; ufOab?: string }>
  raw_payload: DjenCommunication
  synced_at: string
  status: 'A triar'
}

const HTML_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä',
  egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï',
  ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü',
  ccedil: 'ç', ndash: '–', mdash: '—', hellip: '…',
  ordm: 'º', ordf: 'ª', sect: '§', euro: '€',
}

/** Remove HTML do teor da comunicação e decodifica entidades comuns. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|section|article|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === '#') {
        const hex = entity[1]?.toLowerCase() === 'x'
        const code = parseInt(hex ? entity.slice(2) : entity.slice(1), hex ? 16 : 10)
        return Number.isFinite(code) ? String.fromCodePoint(code) : match
      }
      if (HTML_ENTITIES[entity] != null) return HTML_ENTITIES[entity]
      const key = entity.toLowerCase()
      const value = HTML_ENTITIES[key]
      if (value == null) return match
      // Entidades como &Atilde; e &Aacute; são case-sensitive no HTML.
      return /^[A-Z]/.test(entity) ? value.toUpperCase() : value
    })
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Normaliza qualquer formato de CNJ para os 20 dígitos usados no banco. */
export function normalizeProcessNumber(value: string | null | undefined): string | null {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length === 20 ? digits : null
}

/** Formata 20 dígitos no padrão NNNNNNN-DD.AAAA.J.TR.OOOO. */
export function formatProcessNumber(value: string | null | undefined): string {
  const digits = normalizeProcessNumber(value) || String(value || '').replace(/\D/g, '')
  if (digits.length !== 20) return String(value || '')
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const parts = trimmed.split('/')
  if (parts.length === 3 && parts[0].length === 2) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function buildSearchParams(filters: DjenSyncFilters, page: number): URLSearchParams {
  const params = new URLSearchParams()
  params.set('dataDisponibilizacaoInicio', filters.startDate)
  params.set('dataDisponibilizacaoFim', filters.endDate)
  params.set('pagina', String(page))
  params.set('itensPorPagina', String(filters.pageSize))

  if (filters.tribunal) params.set('siglaTribunal', filters.tribunal.trim().toUpperCase())
  if (filters.processNumber) params.set('numeroProcesso', filters.processNumber.replace(/\D/g, ''))
  if (filters.oab) params.set('numeroOab', filters.oab.replace(/\D/g, ''))
  if (filters.ufOab) params.set('ufOab', filters.ufOab.trim().toUpperCase())
  if (filters.lawyerName) params.set('nomeAdvogado', filters.lawyerName.trim())
  if (filters.partyName) params.set('nomeParte', filters.partyName.trim())
  if (filters.communicationNumber) params.set('numeroComunicacao', String(filters.communicationNumber))

  return params
}

export function hasDjenFilter(filters: Partial<DjenSyncFilters>): boolean {
  return Boolean(
    filters.tribunal || filters.processNumber || filters.oab ||
    filters.lawyerName || filters.partyName || filters.communicationNumber ||
    filters.pageSize === 5
  )
}

/** Busca uma página. Erros 429 recebem mensagem orientando a esperar ~1 minuto. */
export async function fetchDjenPage(
  filters: DjenSyncFilters,
  page: number
): Promise<{ data: DjenResponse; rateLimitRemaining: number | null }> {
  const url = `${DJEN_API_URL}?${buildSearchParams(filters, page).toString()}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch (error: any) {
    throw new Error(`Não foi possível conectar ao DJEN: ${error?.message || 'falha de rede'}`)
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('O DJEN limitou as requisições (429). Aguarde cerca de 1 minuto antes de tentar novamente.')
    }
    if (response.status === 422) {
      throw new Error('O DJEN rejeitou os filtros informados (422). Informe ao menos um tribunal, processo ou OAB.')
    }
    const detail = await response.text().catch(() => '')
    throw new Error(`Erro na consulta ao DJEN (${response.status}). ${detail.slice(0, 160)}`.trim())
  }

  const data = (await response.json()) as DjenResponse
  if (data.status && data.status.toLowerCase() !== 'success') {
    throw new Error(data.message || 'O DJEN retornou um erro na consulta.')
  }

  const remaining = response.headers.get('x-ratelimit-remaining')
  return {
    data,
    rateLimitRemaining: remaining != null ? Number(remaining) : null,
  }
}

/** Percorre as páginas até esgotar os itens ou atingir o limite de segurança. */
export async function fetchDjenCommunications(filters: DjenSyncFilters): Promise<DjenFetchResult> {
  if (!hasDjenFilter(filters)) {
    throw new Error('Informe ao menos um filtro: tribunal, processo, OAB, advogado ou parte.')
  }

  const all: DjenCommunication[] = []
  let total = 0
  let pagesFetched = 0
  let rateLimitRemaining: number | null = null
  const maxPages = Math.max(1, Math.min(filters.maxPages || 5, 20))

  for (let page = 1; page <= maxPages; page++) {
    const result = await fetchDjenPage(filters, page)
    rateLimitRemaining = result.rateLimitRemaining
    total = result.data.count || 0
    const items = Array.isArray(result.data.items) ? result.data.items : []
    all.push(...items)
    pagesFetched = page

    if (items.length < filters.pageSize) break
    // Pequena pausa para não abusar do limite de requisições por IP.
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  return { items: all, total, pagesFetched, rateLimitRemaining }
}

/** Converte um item cru do DJEN no formato persistido na fila de publicações. */
export function normalizeDjenItem(item: DjenCommunication): NormalizedPublication {
  const rawNumber = item.numero_processo || item.numeroprocessocommascara || ''
  const masked = item.numeroprocessocommascara || (normalizeProcessNumber(rawNumber) ? formatProcessNumber(rawNumber) : null)

  const recipients: NormalizedPublication['recipients'] = []
  ;(item.destinatarios || []).forEach(recipient => {
    if (recipient.nome) {
      recipients.push({ name: recipient.nome, role: recipient.polo })
    }
  })
  ;(item.destinatarioadvogados || []).forEach(entry => {
    const lawyer = entry.advogado
    if (!lawyer?.nome) return
    recipients.push({
      name: lawyer.nome,
      role: 'Advogado(a)',
      lawyer: lawyer.nome,
      oab: lawyer.numero_oab || undefined,
      ufOab: lawyer.uf_oab || undefined,
    })
  })

  return {
    source: 'DJEN',
    external_id: String(item.id ?? item.hash ?? ''),
    process_number: normalizeProcessNumber(rawNumber),
    process_number_masked: masked || null,
    court: item.siglaTribunal || null,
    unit: item.nomeOrgao || null,
    publication_date: toIsoDate(item.data_disponibilizacao || item.datadisponibilizacao),
    page: item.pagina != null ? String(item.pagina) : null,
    communication_number: item.numeroComunicacao != null ? Number(item.numeroComunicacao) : null,
    chamber: item.meio === 'E' ? 'Edital' : 'Judicial',
    importance: null,
    suggested_days: null,
    content: stripHtml(item.texto) || null,
    link: item.link || null,
    document_type: item.tipoDocumento || item.nomeClasse || null,
    communication_type: item.tipoComunicacao || null,
    recipients,
    raw_payload: item,
    synced_at: new Date().toISOString(),
    status: 'A triar',
  }
}

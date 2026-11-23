// Consulta única à API pública do DataJud.
// Esta camada é usada tanto pela consulta avulsa quanto pela sincronização que persiste no banco.

const DATAJUD_MAX_ATTEMPTS = 2
const DATAJUD_RETRY_DELAY_MS = 1000

class DatajudRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'DatajudRequestError'
  }
}

function isRetryableDatajudError(error: unknown): boolean {
  // status 0 = falha de rede/DNS; 5xx = indisponibilidade no gateway do CNJ.
  return error instanceof DatajudRequestError && (error.status === 0 || error.status >= 500)
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const TRIBUNAL_MAP: Record<string, string> = {
  '8.26': 'tjsp',
  '8.13': 'tjmg',
  '8.19': 'tjrj',
  '8.05': 'tjba',
  '8.06': 'tjce',
  '8.07': 'tjdft',
  '8.08': 'tjes',
  '8.09': 'tjgo',
  '8.10': 'tjma',
  '8.11': 'tjmt',
  '8.12': 'tjms',
  '8.14': 'tjpa',
  '8.15': 'tjpb',
  '8.16': 'tjpr',
  '8.17': 'tjpe',
  '8.18': 'tjpi',
  '8.20': 'tjrn',
  '8.21': 'tjrs',
  '8.22': 'tjro',
  '8.23': 'tjrr',
  '8.24': 'tjsc',
  '8.25': 'tjse',
  '8.27': 'tjtoc',
  '4.01': 'trf1',
  '4.02': 'trf2',
  '4.03': 'trf3',
  '4.04': 'trf4',
  '4.05': 'trf5',
  '4.06': 'trf6',
  '5.01': 'trt1',
  '5.02': 'trt2',
  '5.03': 'trt3',
  '5.04': 'trt4',
  '5.05': 'trt5',
  '5.15': 'trt15',
}

export interface DatajudMovement {
  date: string
  description: string
}

export interface DatajudResult {
  success: true
  processNumber: string
  court: string
  status: string
  history: DatajudMovement[]
  meta: {
    foundHits: number
    mostRecentUpdate: string
  }
}

export interface DatajudLookup {
  cleanNumber: string
  tribunalCode: string
  tribunalSlug: string
}

export function resolveTribunal(processNumber: string): DatajudLookup {
  const cleanNumber = processNumber.replace(/\D/g, '')

  if (cleanNumber.length !== 20) {
    throw new Error('Número de processo inválido. Use o formato NNNNNNN-DD.AAAA.J.TR.OOOO.')
  }

  // Formato: NNNNNNNDDAAAAJTROOOO -> J na posição 13, TR nas posições 14-15
  const tribunalCode = `${cleanNumber.substring(13, 14)}.${cleanNumber.substring(14, 16)}`
  const tribunalSlug = TRIBUNAL_MAP[tribunalCode]

  if (!tribunalSlug) {
    throw new Error(`Tribunal não suportado ou código inválido: ${tribunalCode}`)
  }

  return { cleanNumber, tribunalCode, tribunalSlug }
}

async function requestDatajud(url: string, apiKey: string, payload: unknown): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${apiKey}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
  } catch {
    throw new DatajudRequestError(
      0,
      'Não foi possível conectar ao DataJud. Verifique a conexão e tente novamente.'
    )
  }

  if (response.ok) return response

  if (response.status === 429) {
    throw new Error('O DataJud limitou a consulta (429). Aguarde alguns minutos ou use uma chave de API própria.')
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('A chave DATAJUD_API_KEY está inválida ou sem permissão. Renove a chave no Vercel.')
  }

  if (response.status >= 500) {
    // 502/504 costumam ser transitórios no gateway do CNJ. Esconde o HTML do
    // balanceador e sinaliza ao chamador que vale tentar novamente.
    throw new DatajudRequestError(
      response.status,
      `O DataJud está indisponível no momento (${response.status}). Tente novamente em instantes.`
    )
  }

  const detail = await response.text().catch(() => '')
  throw new DatajudRequestError(
    response.status,
    `Erro na consulta ao DataJud (${response.status}). ${detail.slice(0, 180)}`.trim()
  )
}

function parseDatajudResponse(data: any, processNumber: string, tribunalSlug: string): DatajudResult {
  const hits: any[] = data.hits?.hits || []

  if (hits.length === 0) {
    throw new Error('Processo não encontrado no Datajud')
  }

  const movements: any[] = []
  let mainHit = hits[0]._source
  let mostRecentDate = 0

  hits.forEach((hit: any) => {
    const source = hit._source
    const lastUpdate = source.dataHoraUltimaAtualizacao
      ? new Date(source.dataHoraUltimaAtualizacao).getTime()
      : 0

    if (lastUpdate > mostRecentDate) {
      mostRecentDate = lastUpdate
      mainHit = source
    }

    if (source.movimentos) {
      movements.push(...source.movimentos)
    }
  })

  const history: DatajudMovement[] = movements
    .map((movement: any) => {
      const description = movement.movimentoNacional?.nome
        || movement.movimentoLocal?.nome
        || movement.nome
        || 'Movimentação registrada'
      const complement = movement.complementosTabelados?.[0]?.nome
        || movement.complementosTabelados?.[0]?.valor
        || ''

      return {
        date: movement.dataHora || movement.dataMovimentacao,
        description: complement ? `${description} - ${complement}` : description,
      }
    })
    .filter((movement) => Boolean(movement.date))
    .filter((movement, index, all) =>
      all.findIndex((other) => other.date === movement.date && other.description === movement.description) === index
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalHits = typeof data.hits?.total?.value === 'number'
    ? data.hits.total.value
    : hits.length

  return {
    success: true,
    processNumber: mainHit.numeroProcesso || processNumber,
    court: mainHit.tribunal || tribunalSlug.toUpperCase(),
    status: mainHit.classe?.nome || 'Em Andamento',
    history,
    meta: {
      foundHits: totalHits,
      mostRecentUpdate: mostRecentDate
        ? new Date(mostRecentDate).toISOString()
        : new Date().toISOString(),
    },
  }
}

export async function fetchDatajud(processNumber: string, apiKey: string): Promise<DatajudResult> {
  if (!apiKey) {
    throw new Error('DATAJUD_API_KEY não configurada no servidor. Configure a variável no Vercel.')
  }

  const { cleanNumber, tribunalSlug } = resolveTribunal(processNumber)
  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunalSlug}/_search`

  const payload = {
    query: {
      bool: {
        should: [
          { match: { numeroProcesso: cleanNumber } },
          { match: { numeroProcesso: processNumber } },
        ],
        minimum_should_match: 1,
      },
    },
    sort: [{ dataHoraUltimaAtualizacao: { order: 'desc' } }],
    // O processo é identificado pelo número; 10 hits já cobrem réplicas/índices
    // duplicados sem exigir uma resposta grande do DataJud.
    size: 10,
  }

  for (let attempt = 1; attempt <= DATAJUD_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await requestDatajud(url, apiKey, payload)
      return parseDatajudResponse(await response.json(), processNumber, tribunalSlug)
    } catch (error) {
      const retryable = isRetryableDatajudError(error)
      if (!retryable || attempt === DATAJUD_MAX_ATTEMPTS) throw error
      await wait(DATAJUD_RETRY_DELAY_MS)
    }
  }

  throw new Error('Erro inesperado ao consultar o DataJud.')
}

import { GoogleGenAI } from '@google/genai'

/**
 * Modelos tentados em ordem. O Google recomenda Gemini 4 Hydrogen ou
 * 3.5 Flash-Lite para projetos novos; modelos antigos (2.5) nao estao
 * disponiveis para contas novas e modelos populares podem ficar sobrecarregados.
 */
export const GEMINI_MODELS = process.env.GEMINI_MODEL?.trim()
  ? [process.env.GEMINI_MODEL.trim()]
  : [
      'gemini-3.5-flash-lite',
      'gemini-4-hydrogen',
      'gemini-3.6-flash',
      'gemini-3.8-flash',
    ]

export const GEMINI_MODEL = GEMINI_MODELS[0]

/** Limites de tempo: evita que uma acao de IA fique pendurada no navegador. */
const GEMINI_REQUEST_TIMEOUT_MS = 15_000
const GEMINI_TOTAL_TIMEOUT_MS = 25_000

function providerCode(error: unknown): string {
  return String((error as any)?.code ?? '').toUpperCase()
}

function providerStatus(error: unknown): number {
  return Number((error as any)?.status)
}

function isUnavailable(error: unknown): boolean {
  return providerCode(error) === 'UNAVAILABLE' || providerStatus(error) === 503
}

function isTimedOut(error: unknown): boolean {
  const name = String((error as any)?.name ?? '')
  const code = providerCode(error)
  return name === 'AbortError' || code === 'ABORT_ERR' || code === 'ETIMEDOUT'
}

/**
 * Resolucao da chave do Gemini exclusivamente no servidor.
 *
 * A unica fonte autorizada e GEMINI_API_KEY. Nao ha chave manual, variaveis
 * alternativas nem fallback NEXT_PUBLIC_: isso evita que uma chave antiga salva
 * no navegador tenha prioridade sobre a chave configurada no Vercel.
 */
export function resolveGeminiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim()
  return key ? key : undefined
}

/**
 * Cliente unico com retries do SDK desligados. O fallback entre modelos ja
 * faz uma nova tentativa; manter os retries internos multiplicava cada acao
 * por ate 24 chamadas HTTP (4 modelos x 2 tentativas x 3 do SDK).
 */
export function createGeminiClient(): GoogleGenAI {
  const apiKey = resolveGeminiKey()

  if (!apiKey) {
    const error: Error & { code?: string } = new Error(
      'Chave do Gemini nao configurada no servidor.'
    )
    error.code = 'GEMINI_KEY_MISSING'
    throw error
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: GEMINI_REQUEST_TIMEOUT_MS,
      retryOptions: { attempts: 1 },
    },
  })
}

/**
 * Tenta cada modelo da cadeia uma unica vez, com um prazo total compartilhado.
 * So avanca para o proximo modelo em 503/404; outros erros sao propagados.
 */
export async function withGeminiModelFallback<T>(
  call: (model: string, signal: AbortSignal) => Promise<T>
): Promise<T> {
  const signal = AbortSignal.timeout(GEMINI_TOTAL_TIMEOUT_MS)
  let lastError: unknown

  for (const model of GEMINI_MODELS) {
    if (signal.aborted) break

    try {
      return await call(model, signal)
    } catch (error) {
      lastError = error
      if (signal.aborted || isTimedOut(error)) throw error

      const fallback =
        isUnavailable(error) ||
        providerCode(error) === 'NOT_FOUND' ||
        providerStatus(error) === 404
      if (!fallback) throw error

      console.warn(`[gemini] modelo ${model} indisponivel; tentando proximo da cadeia`)
    }
  }

  throw lastError ?? new Error('Nenhum modelo Gemini disponivel.')
}

/** Traduz erros brutos do provedor para mensagens acionaveis. */
export function friendlyGeminiError(error: unknown): Error {
  const code = providerCode(error)
  const status = providerStatus(error)

  if (isTimedOut(error)) {
    const wrapped = new Error(
      'O Gemini demorou para responder. Tente novamente em instantes.'
    )
    ;(wrapped as any).code = 'GEMINI_TIMEOUT'
    return wrapped
  }

  if (isUnavailable(error)) {
    const wrapped = new Error(
      'Os modelos Gemini estao temporariamente indisponiveis. Tente novamente em instantes.'
    )
    ;(wrapped as any).code = 'GEMINI_UNAVAILABLE'
    return wrapped
  }

  if (code === 'RESOURCE_EXHAUSTED' || status === 429) {
    const wrapped = new Error(
      'Limite de uso do Gemini atingido. Aguarde e tente novamente.'
    )
    ;(wrapped as any).code = 'GEMINI_RATE_LIMIT'
    return wrapped
  }

  if (code === 'NOT_FOUND' || status === 404) {
    const wrapped = new Error(
      `Modelo Gemini nao disponivel para esta conta. Modelos tentados: ${GEMINI_MODELS.join(', ')}.`
    )
    ;(wrapped as any).code = 'GEMINI_MODEL_NOT_FOUND'
    return wrapped
  }

  if (error instanceof Error) return error
  return new Error('Erro ao processar com Gemini.')
}

export async function generateGeminiText(
  prompt: string,
  config?: Record<string, unknown>
): Promise<string> {
  const ai = createGeminiClient()

  try {
    const response = await withGeminiModelFallback((model, signal) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: { ...config, abortSignal: signal },
      })
    )
    return response.text || ''
  } catch (error) {
    throw friendlyGeminiError(error)
  }
}

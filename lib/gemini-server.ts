import { GoogleGenAI } from '@google/genai'

/**
 * Modelos tentados em ordem. O Google recomenda Gemini 4 Hydrogen ou
 * 3.5 Flash-Lite para projetos novos; modelos antigos (2.5) nao estao
 * disponiveis para contas novas e models populares podem ficar sobrecarregados.
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

const TRANSIENT_CODES = new Set([
  'UNAVAILABLE',
  'RESOURCE_EXHAUSTED',
  'RATE_LIMIT_EXCEEDED',
  'DEADLINE_EXCEEDED',
  'INTERNAL',
])

function providerCode(error: unknown): string {
  return String((error as any)?.code ?? '').toUpperCase()
}

function providerStatus(error: unknown): number {
  return Number((error as any)?.status)
}

function isUnavailable(error: unknown): boolean {
  return providerCode(error) === 'UNAVAILABLE' || providerStatus(error) === 503
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

/** Repete falhas temporarias do provedor (503/429) com backoff curto. */
export async function geminiWithRetry<T>(
  fn: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const transient =
        TRANSIENT_CODES.has(providerCode(error)) ||
        [429, 500, 503].includes(providerStatus(error))

      if (!transient || attempt === attempts - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }

  throw lastError
}

/** Tenta cada modelo da cadeia quando o provedor devolve 503 ou 404. */
export async function withGeminiModelFallback<T>(
  call: (model: string) => Promise<T>
): Promise<T> {
  let lastError: unknown

  for (const model of GEMINI_MODELS) {
    try {
      return await geminiWithRetry(() => call(model), 2)
    } catch (error) {
      lastError = error
      const fallback =
        isUnavailable(error) ||
        providerCode(error) === 'NOT_FOUND' ||
        providerStatus(error) === 404
      if (!fallback) throw error
      console.warn(`[gemini] modelo ${model} indisponivel; tentando proximo da cadeia`)
    }
  }

  throw lastError
}

/** Traduz erros brutos do provedor para mensagens acionaveis. */
export function friendlyGeminiError(error: unknown): Error {
  const code = providerCode(error)
  const status = providerStatus(error)

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
  const apiKey = resolveGeminiKey()

  if (!apiKey) {
    const error: Error & { code?: string } = new Error(
      'Chave do Gemini nao configurada no servidor.'
    )
    error.code = 'GEMINI_KEY_MISSING'
    throw error
  }

  const ai = new GoogleGenAI({ apiKey })

  try {
    const response = await withGeminiModelFallback((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config,
      })
    )
    return response.text || ''
  } catch (error) {
    throw friendlyGeminiError(error)
  }
}

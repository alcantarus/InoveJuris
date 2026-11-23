import { GoogleGenAI } from '@google/genai'

/**
 * Modelo padrao recomendado pelo Google AI Studio para contas novas.
 * Modelos antigos (2.5-flash, 3-flash-preview) nao estao mais disponiveis
 * para novos usuarios. Pode ser substituido por GEMINI_MODEL.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash'

const TRANSIENT_CODES = new Set([
  'UNAVAILABLE',
  'RESOURCE_EXHAUSTED',
  'RATE_LIMIT_EXCEEDED',
  'DEADLINE_EXCEEDED',
  'INTERNAL',
])

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
      const code = String((error as any)?.code ?? '').toUpperCase()
      const status = Number((error as any)?.status)
      const transient =
        TRANSIENT_CODES.has(code) ||
        status === 429 ||
        status === 500 ||
        status === 503

      if (!transient || attempt === attempts - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }

  throw lastError
}

/** Traduz erros brutos do provedor para mensagens acionaveis. */
export function friendlyGeminiError(error: unknown): Error {
  const code = String((error as any)?.code ?? '').toUpperCase()
  const status = Number((error as any)?.status)

  if (code === 'UNAVAILABLE' || status === 503) {
    const wrapped = new Error(
      'O modelo Gemini esta temporariamente indisponivel. Tente novamente em instantes.'
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
      `Modelo ${GEMINI_MODEL} nao disponivel para esta conta. Verifique GEMINI_MODEL no Vercel.`
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
    const response = await geminiWithRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config,
      })
    )
    return response.text || ''
  } catch (error) {
    throw friendlyGeminiError(error)
  }
}

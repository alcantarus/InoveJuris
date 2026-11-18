import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-3-flash-preview'

/**
 * Resolve a chave do Gemini exclusivamente no servidor.
 *
 * A chave manual informada pelo próprio usuário tem prioridade. Depois vem a
 * chave dedicada do servidor. A variável NEXT_PUBLIC_ permanece apenas como
 * fallback temporário até a rotacao, para nao quebrar a configuracao atual.
 * Nenhum componente client deve referenciar este modulo ou a variavel legada.
 */
export function resolveGeminiKey(manualKey?: string): string | undefined {
  const raw =
    manualKey?.trim() ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY

  const key = raw?.trim()
  return key ? key : undefined
}

export async function generateGeminiText(
  prompt: string,
  manualKey?: string,
  config?: Record<string, unknown>
): Promise<string> {
  const apiKey = resolveGeminiKey(manualKey)

  if (!apiKey) {
    const error: Error & { code?: string } = new Error(
      'Chave do Gemini nao configurada no servidor.'
    )
    error.code = 'GEMINI_KEY_MISSING'
    throw error
  }

  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config,
  })

  return response.text || ''
}

import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-3-flash-preview'

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
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config,
  })

  return response.text || ''
}

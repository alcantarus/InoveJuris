'use client'

import { useEffect } from 'react'

/**
 * Remove as chaves manuais legadas do localStorage.
 *
 * Elas eram usadas pelas telas de Leads e Configuracoes -> Marketing e tinham
 * prioridade sobre a chave do servidor. Apos a configuracao de GEMINI_API_KEY
 * no Vercel, qualquer valor restante no navegador pode fazer a IA falhar.
 * Componente invisivel, montado nos layouts raiz.
 */
export function GeminiLegacyCleanup() {
  useEffect(() => {
    try {
      localStorage.removeItem('gemini_manual_key')
      localStorage.removeItem('GEMINI_API_KEY')
    } catch {
      // localStorage pode estar indisponivel (modo privado, politica do navegador).
    }
  }, [])

  return null
}

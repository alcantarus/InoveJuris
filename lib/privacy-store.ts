/**
 * Store mínimo compartilhado entre o PrivacyProvider (React) e as funções de
 * formatação em lib/utils.ts. Não é um estado do React: ele só permite que
 * formatCurrency()/formatPercent() consultem o modo privacidade global sem
 * precisar receber um hook em cada um dos ~120 pontos de chamada.
 */

let globallyHidden = false

export const PRIVACY_GLOBAL_STORAGE_KEY = 'privacy_global_hidden'

export function isPrivacyGloballyHidden(): boolean {
  return globallyHidden
}

export function setPrivacyGloballyHidden(value: boolean): void {
  globallyHidden = value

  if (typeof document !== 'undefined') {
    document.body.dataset.privacyHidden = String(value)
  }
}

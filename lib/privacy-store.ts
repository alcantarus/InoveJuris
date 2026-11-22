/**
 * Store mínimo compartilhado entre o PrivacyProvider (React) e as funções de
 * formatação em lib/utils.ts. Não é um estado do React: ele só permite que
 * formatCurrency()/formatPercent() consultem o modo privacidade global sem
 * precisar receber um hook em cada um dos ~120 pontos de chamada.
 */

let globallyHidden = false

type Listener = () => void
const listeners = new Set<Listener>()

export const PRIVACY_GLOBAL_STORAGE_KEY = 'privacy_global_hidden'

export function isPrivacyGloballyHidden(): boolean {
  return globallyHidden
}

/** Snapshot usado por useSyncExternalStore. */
export function getPrivacySnapshot(): boolean {
  return globallyHidden
}

/** Inscrição usada pelos componentes que renderizam valores mas não consomem o contexto. */
export function subscribePrivacy(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setPrivacyGloballyHidden(value: boolean): void {
  if (globallyHidden === value) return

  globallyHidden = value

  if (typeof document !== 'undefined') {
    document.body.dataset.privacyHidden = String(value)
  }

  listeners.forEach(listener => listener())
}

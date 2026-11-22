'use client'

import { useSyncExternalStore } from 'react'
import { getPrivacySnapshot, subscribePrivacy } from './privacy-store'

/**
 * Força o re-render de componentes que chamam formatCurrency()/formatPercent()
 * mas não consomem o PrivacyContext (por exemplo cards com React.memo).
 * O valor de retorno não precisa ser usado: a inscrição é o que importa.
 */
export function usePrivacyVersion(): boolean {
  return useSyncExternalStore(
    subscribePrivacy,
    getPrivacySnapshot,
    getPrivacySnapshot,
  )
}

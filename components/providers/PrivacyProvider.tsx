'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  PRIVACY_GLOBAL_STORAGE_KEY,
  setPrivacyGloballyHidden,
} from '@/lib/privacy-store';

interface PrivacyContextType {
  isVisible: (id: string) => boolean;
  toggleVisibility: (id: string) => void;
  /** Modo privacidade global (liga/desliga na dashboard, refletido no header). */
  isGloballyHidden: boolean;
  toggleGlobalVisibility: () => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isVisible: () => true,
  toggleVisibility: () => {},
  isGloballyHidden: false,
  toggleGlobalVisibility: () => {},
});

function readStoredGlobalHidden(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PRIVACY_GLOBAL_STORAGE_KEY) === 'true';
  } catch (e) {
    console.error('Failed to read global privacy mode', e);
    return false;
  }
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('privacy_visibility_map');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        console.error('Failed to parse privacy map', e);
        return {};
      }
    }
    return {};
  });

  const [globalHidden, setGlobalHidden] = useState<boolean>(() => {
    const stored = readStoredGlobalHidden();
    // Aplica antes de renderizar os filhos para evitar flash dos valores.
    setPrivacyGloballyHidden(stored);
    return stored;
  });

  // Publica o modo global no store usado por formatCurrency/formatPercent e
  // mantém o atributo no <body> que desabilita os olhinhos individuais via CSS.
  useEffect(() => {
    setPrivacyGloballyHidden(globalHidden);
    try {
      localStorage.setItem(PRIVACY_GLOBAL_STORAGE_KEY, String(globalHidden));
    } catch (e) {
      console.error('Failed to save global privacy mode', e);
    }
  }, [globalHidden]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('privacy_visibility_map', JSON.stringify(visibilityMap));
    }
  }, [visibilityMap]);

  const isVisible = (id: string) => {
    // O modo global tem precedência sobre qualquer chave individual.
    return !globalHidden && visibilityMap[id] !== false;
  };

  const toggleVisibility = (id: string) => {
    // Enquanto o modo global estiver ligado, os olhinhos individuais ficam
    // inativos (também desabilitados visualmente no CSS global).
    if (globalHidden) return;
    setVisibilityMap(prev => ({
      ...prev,
      [id]: !isVisible(id)
    }));
  };

  const toggleGlobalVisibility = () => {
    const next = !globalHidden;
    // Atualiza o store SINCRONAMENTE, antes do render seguinte. Se isso
    // ficasse só no useEffect, os componentes que leem o contexto renderizariam
    // com globalHidden atualizado mas com formatCurrency ainda consultando o
    // valor antigo do store — deixando números mascarados após "Exibir valores".
    setPrivacyGloballyHidden(next);
    // "Exibir valores" deve mostrar tudo: descarta overrides individuais
    // antigos que, de outra forma, continuariam mascarando alguns cards.
    if (!next) {
      setVisibilityMap({});
    }
    setGlobalHidden(next);
  };

  return (
    <PrivacyContext.Provider
      value={{
        isVisible,
        toggleVisibility,
        isGloballyHidden: globalHidden,
        toggleGlobalVisibility,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
}

export const usePrivacy = () => useContext(PrivacyContext);

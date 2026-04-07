'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PrivacyContextType {
  isVisible: (id: string) => boolean;
  toggleVisibility: (id: string) => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  isVisible: () => true,
  toggleVisibility: () => {},
});

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('privacy_visibility_map', JSON.stringify(visibilityMap));
    }
  }, [visibilityMap]);

  const isVisible = (id: string) => {
    // Default to true if not set
    return visibilityMap[id] !== false;
  };

  const toggleVisibility = (id: string) => {
    setVisibilityMap(prev => ({
      ...prev,
      [id]: !isVisible(id)
    }));
  };

  return (
    <PrivacyContext.Provider value={{ isVisible, toggleVisibility }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export const usePrivacy = () => useContext(PrivacyContext);

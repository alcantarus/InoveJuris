'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { supabase, setCurrentOrgId } from '@/lib/supabase';

const OrganizationContext = createContext({ loading: true });

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeOrganization = async () => {
      const orgId = localStorage.getItem('app_org');
      if (orgId) {
        setCurrentOrgId(orgId);
        console.log('[OrganizationProvider] Definindo organização no banco:', orgId);
        try {
          await supabase.rpc('set_app_organization', { org_id: orgId });
        } catch (e) {
          console.error('[OrganizationProvider] Erro ao definir organização no banco:', e);
        }
      }
      setLoading(false);
    };
    initializeOrganization();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Carregando sistema...</div>;
  }

  return (
    <OrganizationContext.Provider value={{ loading }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);

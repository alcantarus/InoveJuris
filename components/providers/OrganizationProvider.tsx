'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';

const OrganizationContext = createContext({ loading: true });

export function OrganizationProvider({ children, initialOrgId }: { children: React.ReactNode, initialOrgId?: string }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeOrganization = async () => {
      try {
        let orgId = initialOrgId;
        if (!orgId) {
          orgId = localStorage.getItem('app_org') || undefined;
        }
        
        // Define a organização no contexto do banco de dados
        if (orgId) {
          console.log('[OrganizationProvider] Definindo organização no banco:', orgId);
          await supabase.rpc('set_app_organization', { org_id: orgId });
        } else {
          console.log('[OrganizationProvider] Nenhuma organização encontrada para definir no banco.');
        }
      } catch (e) {
        console.error('[OrganizationProvider] Erro ao definir contexto no banco:', e);
      } finally {
        setLoading(false);
      }
    };
    initializeOrganization();
  }, [initialOrgId]);

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

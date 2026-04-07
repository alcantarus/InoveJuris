'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const initializeOrganization = async () => {
      const orgId = localStorage.getItem('app_org');
      if (orgId) {
        console.log('[OrganizationProvider] Definindo organização no banco:', orgId);
        try {
          await supabase.rpc('set_app_organization', { org_id: orgId });
        } catch (e) {
          console.error('[OrganizationProvider] Erro ao definir organização no banco:', e);
        }
      }
    };
    initializeOrganization();
  }, []);

  return <>{children}</>;
}

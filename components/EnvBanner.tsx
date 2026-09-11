'use client'

import React from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { getAppEnv } from '@/lib/env'

export function EnvBanner() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const env = getAppEnv();

  if (env === 'production') {
    return (
      <div className="fixed top-0 left-0 right-0 bg-emerald-600 text-white py-1 px-4 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-sm z-[1000] h-8">
        <ShieldCheck size={14} />
        AMBIENTE DE PRODUÇÃO
      </div>
    )
  }

  if (env === 'test') {
    return (
      <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white py-1 px-4 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-sm z-[1000] animate-pulse h-8">
        <AlertTriangle size={14} />
        AMBIENTE DE TESTES - HOMOLOGAÇÃO
      </div>
    )
  }

  return null
}

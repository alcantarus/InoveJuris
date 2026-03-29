'use client'
import { useSettings } from '@/components/providers/SettingsProvider'
import { getIsProduction, getEnvName } from '@/lib/env'
import { Briefcase, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'

export function Header({ name }: { name: string }) {
  const { settings } = useSettings()
  const isProduction = getIsProduction()
  const envName = getEnvName()

  return (
    <header className="mb-10">
      {isProduction && (
        <div className="mb-6 flex items-center justify-center gap-2 bg-emerald-600 text-white text-xs font-bold py-2 px-4 rounded-full shadow-sm">
          <CheckCircle2 size={14} />
          <span>{envName.toUpperCase()}</span>
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm flex items-center justify-center">
              {settings.office_logo ? (
                <Image 
                  src={settings.office_logo} 
                  alt="Logomarca do Escritório" 
                  fill
                  className="object-contain p-1"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Briefcase className="text-indigo-600" size={20} />
              )}
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">InoveJuris</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">Portal do Indicador</h1>
          <p className="text-lg text-slate-600 mt-1">Olá, <span className="font-semibold text-indigo-600">{name}</span>. Bem-vindo ao seu painel de resultados.</p>
        </div>
      </div>
    </header>
  )
}

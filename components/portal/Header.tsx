'use client'
import { useSettings } from '@/components/providers/SettingsProvider'
import { Briefcase } from 'lucide-react'
import Image from 'next/image'

export function Header({ name }: { name: string }) {
  const { settings } = useSettings()

  return (
    <header className="mb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm flex items-center justify-center">
            {settings.office_logo ? (
              <Image 
                src={settings.office_logo} 
                alt="Logomarca do Escritório" 
                fill
                className="object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Briefcase className="text-indigo-600" size={32} />
            )}
          </div>
          <div>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">InoveJuris</span>
            <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">Portal do Indicador</h1>
          </div>
        </div>
      </div>
      <p className="text-lg text-slate-600 mt-6">Olá, <span className="font-semibold text-indigo-600">{name}</span>. Bem-vindo ao seu painel de resultados.</p>
    </header>
  )
}

'use client'
import { useSettings } from '@/components/providers/SettingsProvider'
import Image from 'next/image'

export function Header({ name }: { name: string }) {
  const { settings } = useSettings()

  return (
    <header className="mb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {settings.office_logo && (
            <div className="relative w-32 h-16">
              <Image 
                src={settings.office_logo} 
                alt="Logomarca do Escritório" 
                fill
                className="object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
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

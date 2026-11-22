'use client'

import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import { cn } from '@/lib/utils'

interface GlobalPrivacyToggleProps {
  /** Versão compacta usada no topo dos módulos; a completa fica na dashboard. */
  compact?: boolean
}

export function GlobalPrivacyToggle({ compact = false }: GlobalPrivacyToggleProps) {
  const { isGloballyHidden, toggleGlobalVisibility } = usePrivacy()

  const label = isGloballyHidden
    ? 'Valores ocultos — clique para exibir'
    : 'Ocultar todos os valores'

  if (compact) {
    return (
      <button
        type="button"
        data-privacy-master
        onClick={toggleGlobalVisibility}
        title={label}
        aria-label={label}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all',
          isGloballyHidden
            ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
        )}
      >
        {isGloballyHidden ? <EyeOff size={15} /> : <Eye size={15} />}
        <span>{isGloballyHidden ? 'Valores ocultos' : 'Privacidade'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      data-privacy-master
      onClick={toggleGlobalVisibility}
      title={label}
      aria-label={label}
      aria-pressed={isGloballyHidden}
      className={cn(
        'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm transition-all active:scale-95',
        isGloballyHidden
          ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
          : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md'
      )}
    >
      {isGloballyHidden ? <EyeOff size={18} /> : <Eye size={18} />}
      <span>{isGloballyHidden ? 'Exibir valores' : 'Ocultar valores'}</span>
      {isGloballyHidden && <ShieldCheck size={16} className="text-amber-600" />}
    </button>
  )
}

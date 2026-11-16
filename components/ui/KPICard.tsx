import React from 'react';
import { LucideIcon, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  className?: string;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}

export function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  color = 'slate', 
  className,
  isVisible = true,
  onToggleVisibility
}: KPICardProps) {
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-50 text-slate-600',
  };

  return (
    <div className={cn("bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4 relative group", className)}>
      <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0", colorClasses[color])}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{title}</p>
          {onToggleVisibility && (
            <button 
              onClick={(e) => { e.preventDefault(); onToggleVisibility(); }}
              className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
              title={isVisible ? "Ocultar valor" : "Mostrar valor"}
            >
              {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          )}
        </div>
        <p className={cn(
          "text-xl sm:text-2xl font-bold text-slate-900 break-words leading-tight transition-all duration-300",
          !isVisible && "blur-md select-none"
        )}>
          {isVisible ? value : '••••••'}
        </p>
      </div>
    </div>
  );
}

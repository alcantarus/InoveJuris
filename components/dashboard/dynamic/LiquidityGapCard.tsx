import React from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

export const LiquidityGapCard = ({ gap, isVisible, toggleVisibility }: { gap: number, isVisible: boolean, toggleVisibility: () => void }) => {
  const isNegative = gap < 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white p-6 rounded-3xl border shadow-sm transition-all",
        isNegative ? "border-rose-200" : "border-emerald-200"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <AlertCircle className={isNegative ? "text-rose-500" : "text-emerald-500"} size={20} />
          Gap de Liquidez (7 dias)
        </h3>
        <button 
          onClick={toggleVisibility}
          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
          title={isVisible ? "Ocultar valor" : "Mostrar valor"}
        >
          {isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>
      <p className={cn("text-2xl md:text-3xl font-bold text-slate-900 mb-2 truncate", !isVisible && "font-mono")}>
        {isVisible ? formatCurrency(gap) : '••••••'}
      </p>
      <p className={cn("text-sm font-medium", isNegative ? "text-rose-600" : "text-emerald-600")}>
        {isNegative ? "Atenção: Déficit projetado" : "Fluxo positivo projetado"}
      </p>
      <button 
        onClick={() => alert("Funcionalidade de projeção detalhada em desenvolvimento.")}
        className="mt-4 w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
      >
        {isNegative ? "Agendar Cobranças" : "Ver Projeção"}
      </button>
    </motion.div>
  );
};

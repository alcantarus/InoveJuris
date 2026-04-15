import React, { useState } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { Modal } from '@/components/Modal';

export const LiquidityGapCard = ({ gap, isVisible, toggleVisibility }: { gap: number, isVisible: boolean, toggleVisibility: () => void }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isNegative = gap < 0;
  
  return (
    <>
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
        <p className={cn("text-2xl font-bold text-slate-900 mb-2 break-words", !isVisible && "font-mono")}>
          {isVisible ? formatCurrency(gap) : '••••••'}
        </p>
        <p className={cn("text-sm font-medium", isNegative ? "text-rose-600" : "text-emerald-600")}>
          {isNegative ? "Atenção: Déficit projetado" : "Fluxo positivo projetado"}
        </p>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="mt-4 w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          {isNegative ? "Agendar Cobranças" : "Ver Projeção"}
        </button>
      </motion.div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Projeção de Liquidez (7 dias)"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Esta funcionalidade está em fase de implementação. Em breve, você poderá visualizar aqui o detalhamento do fluxo de caixa projetado para os próximos 7 dias.
          </p>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-sm font-semibold text-slate-900">Saldo Projetado:</p>
            <p className={cn("text-2xl font-bold", isNegative ? "text-rose-600" : "text-emerald-600")}>
              {formatCurrency(gap)}
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};

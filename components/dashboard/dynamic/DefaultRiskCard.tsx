import React from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { AlertOctagon, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export const DefaultRiskCard = ({ riskAmount, count, onAction }: { riskAmount: number, count: number, onAction: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <AlertOctagon className="text-rose-500" size={20} />
          Risco de Inadimplência
        </h3>
        <span className="text-2xl font-black text-rose-600">{count}</span>
      </div>
      <p className="text-sm text-slate-500 mb-4">Total em risco: {formatCurrency(riskAmount)}</p>
      <button 
        onClick={onAction}
        className="flex items-center justify-between w-full p-3 bg-rose-50 text-rose-800 rounded-xl text-sm font-semibold hover:bg-rose-100 transition-colors"
      >
        <span>Iniciar Renegociação</span>
        <ChevronRight size={16} />
      </button>
    </motion.div>
  );
};

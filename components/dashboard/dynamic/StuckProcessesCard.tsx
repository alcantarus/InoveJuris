import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export const StuckProcessesCard = ({ count, onAction }: { count: number, onAction: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="text-amber-500" size={20} />
          Processos Estagnados
        </h3>
        <span className="text-2xl font-black text-amber-600">{count}</span>
      </div>
      <p className="text-sm text-slate-500 mb-4">Processos sem movimentação há mais de 30 dias.</p>
      <button 
        onClick={onAction}
        className="flex items-center justify-between w-full p-3 bg-amber-50 text-amber-800 rounded-xl text-sm font-semibold hover:bg-amber-100 transition-colors"
      >
        <span>Ver Processos</span>
        <ChevronRight size={16} />
      </button>
    </motion.div>
  );
};

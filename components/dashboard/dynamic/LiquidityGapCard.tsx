import React, { useState, useEffect } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';

export const LiquidityGapCard = ({ gap, isVisible, toggleVisibility }: { gap: number, isVisible: boolean, toggleVisibility: () => void }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<any[]>([]);
  const isNegative = gap < 0;

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      
      const { data, error } = await supabase
        .from('installments')
        .select('*, contracts(clients(name))')
        .in('status', ['Aberto', 'Parcial', 'Prorrogada', 'Atrasada'])
        .gte('dueDate', today.toISOString().split('T')[0])
        .lte('dueDate', nextWeek.toISOString().split('T')[0]);

      if (error) throw error;
      setDetails(data || []);
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isModalOpen) {
      fetchDetails();
    }
  }, [isModalOpen]);
  
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
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm font-semibold text-slate-900">Saldo Projetado:</p>
              <p className={cn("text-2xl font-bold", isNegative ? "text-rose-600" : "text-emerald-600")}>
                {formatCurrency(gap)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Detalhamento (Próximos 7 dias):</p>
              {details.length > 0 ? (
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {details.map((inst: any) => (
                    <div key={inst.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{inst.contracts?.clients?.name || 'Cliente'}</p>
                        <p className="text-xs text-slate-500">Vencimento: {new Date(inst.dueDate).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <p className="font-bold text-slate-900">{formatCurrency(Number(inst.amount) - Number(inst.amountPaid))}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Nenhuma parcela prevista para os próximos 7 dias.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

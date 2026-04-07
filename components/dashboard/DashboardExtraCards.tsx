'use client'

import React, { useRef } from 'react'
import { motion } from 'motion/react'
import { Users, DollarSign, Clock, BarChart3, Eye, EyeOff } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { AutoResizeText } from '@/components/ui/AutoResizeText'

interface DashboardExtraCardsProps {
  data: any;
  isVisible: (key: string) => boolean;
  toggleVisibility: (key: string) => void;
  user: any;
}

export default function DashboardExtraCards({ data, isVisible, toggleVisibility, user }: DashboardExtraCardsProps) {
  const newClientsRef = useRef<HTMLDivElement>(null);
  const financeRef = useRef<HTMLDivElement>(null);
  const workloadRef = useRef<HTMLDivElement>(null);
  const cycleTimeRef = useRef<HTMLDivElement>(null);
  // Calculations
  const newClientsCount = data.clients.filter((c: any) => new Date(c.created_at).getMonth() === new Date().getMonth()).length;
  
  const totalReceived = data.transactions.reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0);
  const totalReceivable = data.installments
    .filter((t: any) => ['Aberto', 'Parcial', 'Prorrogada', 'Atrasada'].includes(t.status))
    .reduce((acc: number, t: any) => acc + (Number(t.amount) || 0) - (Number(t.amountPaid) || 0), 0);

  // Workload by User
  const workload: Record<string, number> = {};
  data.processes.forEach((p: any) => {
    const user = p.created_by || 'Não atribuído';
    workload[user] = (workload[user] || 0) + 1;
  });

  // Cycle Time (simplified)
  const completedProcesses = data.processes.filter((p: any) => p.status === 'Arquivado' && p.created_at && p.last_update);
  const totalCycleTime = completedProcesses.reduce((acc: number, p: any) => {
    return acc + (new Date(p.last_update).getTime() - new Date(p.created_at).getTime());
  }, 0);
  const avgCycleTime = completedProcesses.length > 0 ? (totalCycleTime / completedProcesses.length) / (1000 * 60 * 60 * 24) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Novos Clientes */}
      {user?.canAccessClients && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm" ref={newClientsRef}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Novos Clientes (Mês)</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => toggleVisibility('dashboard_new_clients')}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {isVisible('dashboard_new_clients') ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <Users className="text-blue-500" size={20} />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 overflow-hidden whitespace-nowrap">
            <AutoResizeText 
              text={isVisible('dashboard_new_clients') ? newClientsCount.toString() : '••'} 
              className="font-bold text-slate-900"
              containerRef={newClientsRef}
            />
          </div>
        </motion.div>
      )}

      {/* Resumo Financeiro */}
      {user?.canAccessFinance && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm" ref={financeRef}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Resumo Financeiro</h3>
            <button 
              onClick={() => toggleVisibility('dashboard_finance')}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              {isVisible('dashboard_finance') ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          <div className="flex justify-between gap-4">
            <div className="overflow-hidden whitespace-nowrap">
              <p className="text-xs text-slate-500">Recebido</p>
              <AutoResizeText 
                text={formatCurrency(totalReceived, isVisible('dashboard_finance'))}
                className="text-lg font-bold text-emerald-600"
                containerRef={financeRef}
              />
            </div>
            <div className="overflow-hidden whitespace-nowrap">
              <p className="text-xs text-slate-500">A Receber</p>
              <AutoResizeText 
                text={formatCurrency(totalReceivable, isVisible('dashboard_finance'))}
                className="text-lg font-bold text-indigo-600"
                containerRef={financeRef}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Carga de Trabalho */}
      {user?.canAccessProcesses && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm" ref={workloadRef}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Carga de Trabalho</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => toggleVisibility('dashboard_workload')}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {isVisible('dashboard_workload') ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <BarChart3 className="text-violet-500" size={20} />
            </div>
          </div>
          <div className="text-sm text-slate-600 overflow-hidden whitespace-nowrap">
            <AutoResizeText 
              text={isVisible('dashboard_workload') ? `${Object.keys(workload).length} usuários ativos` : '•• usuários ativos'}
              className="text-sm text-slate-600"
              containerRef={workloadRef}
            />
          </div>
        </motion.div>
      )}

      {/* Tempo Médio de Ciclo */}
      {user?.canAccessProcesses && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm" ref={cycleTimeRef}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Ciclo Médio (Dias)</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => toggleVisibility('dashboard_cycle_time')}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {isVisible('dashboard_cycle_time') ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              <Clock className="text-amber-500" size={20} />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 overflow-hidden whitespace-nowrap">
            <AutoResizeText 
              text={isVisible('dashboard_cycle_time') ? avgCycleTime.toFixed(0) : '••'}
              className="font-bold text-slate-900"
              containerRef={cycleTimeRef}
            />
          </div>
        </motion.div>
      )}
    </div>
  )
}

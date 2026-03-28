'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Target, TrendingUp, Clock, CheckCircle2, Save, Zap } from 'lucide-react';
import { useSettings } from '@/components/providers/SettingsProvider';
import { toast } from 'sonner';

export function GoalsTab() {
  const { settings, updateSetting } = useSettings();
  
  const [monthlyRevenue, setMonthlyRevenue] = useState<string>(
    (settings.dashboard_goals?.monthly_revenue || 150000).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  );
  const [winRateTarget, setWinRateTarget] = useState(settings.dashboard_goals?.win_rate_target || 80);
  const [leadTimeTarget, setLeadTimeTarget] = useState(settings.dashboard_goals?.lead_time_target || 45);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (settings.dashboard_goals) {
      setMonthlyRevenue(settings.dashboard_goals.monthly_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
      setWinRateTarget(settings.dashboard_goals.win_rate_target);
      setLeadTimeTarget(settings.dashboard_goals.lead_time_target);
    }
  }, [settings]);

  const parseCurrency = (val: string) => {
    const clean = val.replace(/[^\d,]/g, '').replace(',', '.');
    return Number(clean);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading('Salvando metas...');
    try {
      const revenue = parseCurrency(monthlyRevenue);
      if (isNaN(revenue)) {
        throw new Error('Valor de faturamento inválido. Use o formato 0.000,00');
      }

      await updateSetting('dashboard_goals', {
        monthly_revenue: revenue,
        win_rate_target: Number(winRateTarget),
        lead_time_target: Number(leadTimeTarget)
      });
      
      setShowSuccess(true);
      toast.success('Metas atualizadas com sucesso!', { id: loadingToast });
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save goals:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao salvar metas: ${errorMessage}`, { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevenueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Allow only digits and one comma
    value = value.replace(/[^\d,]/g, '');
    const parts = value.split(',');
    if (parts.length > 2) value = parts[0] + ',' + parts.slice(1).join('');
    setMonthlyRevenue(value);
  };

  const handleRevenueBlur = () => {
    const num = parseCurrency(monthlyRevenue);
    if (!isNaN(num)) {
      setMonthlyRevenue(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Metas Financeiras"
        description="Defina os objetivos de faturamento para o escritório."
      >
        <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8">
          <div>
            <label htmlFor="monthly_revenue" className="block text-sm font-medium text-slate-700">Meta de Faturamento Mensal (R$)</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Target className="h-4 w-4 text-slate-600" />
              </div>
              <input
                type="text"
                id="monthly_revenue"
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 px-3 border bg-white"
                value={monthlyRevenue}
                onChange={handleRevenueChange}
                onBlur={handleRevenueBlur}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">Este valor será usado no termômetro de metas do dashboard.</p>
          </div>
        </div>
      </Card>

      <Card
        title="Metas de Performance"
        description="Objetivos operacionais e de eficiência jurídica."
      >
        <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8">
          <div>
            <label htmlFor="win_rate" className="block text-sm font-medium text-slate-700">Taxa de Sucesso Alvo (%)</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <TrendingUp className="h-4 w-4 text-slate-600" />
              </div>
              <input
                type="number"
                id="win_rate"
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 px-3 border bg-white"
                value={winRateTarget}
                onChange={(e) => setWinRateTarget(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label htmlFor="lead_time" className="block text-sm font-medium text-slate-700">Lead Time Alvo (Dias)</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Clock className="h-4 w-4 text-slate-600" />
              </div>
              <input
                type="number"
                id="lead_time"
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 px-3 border bg-white"
                value={leadTimeTarget}
                onChange={(e) => setLeadTimeTarget(Number(e.target.value))}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">Tempo médio desejado entre a abertura e o arquivamento do processo.</p>
          </div>
        </div>
      </Card>

      <Card
        title="Gargalos e Alertas"
        description="Configurações de monitoramento de eficiência."
      >
        <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Zap size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-900">Monitoramento Automático</p>
              <p className="text-xs text-indigo-700">O sistema alertará automaticamente quando processos excederem o Lead Time alvo.</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {showSuccess && (
          <span className="flex items-center text-sm text-emerald-600 animate-in fade-in slide-in-from-right-2">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Metas salvas!
          </span>
        )}
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed gap-2"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save size={18} />
              Salvar Metas
            </>
          )}
        </button>
      </div>
    </div>
  );
}

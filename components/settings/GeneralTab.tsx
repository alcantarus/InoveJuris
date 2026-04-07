'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Switch } from '../ui/Switch';
import { Globe, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useSettings } from '@/components/providers/SettingsProvider';
import { LogoUpload } from './LogoUpload';

export function GeneralTab() {
  const { settings, updateSetting } = useSettings();
  
  const [timezone, setTimezone] = useState(settings.general_preferences.timezone);
  const [dateFormat, setDateFormat] = useState(settings.general_preferences.date_format);
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenance_mode.enabled);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTimezone(settings.general_preferences.timezone);
    setDateFormat(settings.general_preferences.date_format);
    setMaintenanceMode(settings.maintenance_mode.enabled);
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSetting('general_preferences', {
        timezone,
        date_format: dateFormat
      });
      await updateSetting('maintenance_mode', {
        enabled: maintenanceMode
      });
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Preferências Regionais"
        description="Configurações de fuso horário, idioma e formatos de data."
      >
        <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8">
          <LogoUpload />
          
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-slate-700">Fuso Horário</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Globe className="h-4 w-4 text-slate-600" />
              </div>
              <select 
                id="timezone" 
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 px-3 border bg-white"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option>America/Sao_Paulo (GMT-03:00)</option>
                <option>America/Manaus (GMT-04:00)</option>
                <option>UTC (GMT+00:00)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="dateformat" className="block text-sm font-medium text-slate-700">Formato de Data</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Clock className="h-4 w-4 text-slate-600" />
              </div>
              <select 
                id="dateformat" 
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 px-3 border bg-white"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
              >
                <option>DD/MM/YYYY (31/12/2026)</option>
                <option>MM/DD/YYYY (12/31/2026)</option>
                <option>YYYY-MM-DD (2026-12-31)</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Modo de Manutenção"
        description="Bloqueia o acesso de usuários comuns ao sistema enquanto você realiza atualizações críticas."
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Ativar Modo de Manutenção</p>
              <p className="text-sm text-slate-600">Apenas administradores poderão fazer login.</p>
            </div>
          </div>
          <Switch 
            initialChecked={maintenanceMode} 
            onChange={setMaintenanceMode}
          />
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {showSuccess && (
          <span className="flex items-center text-sm text-emerald-600 animate-in fade-in slide-in-from-right-2">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Configurações salvas!
          </span>
        )}
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
}

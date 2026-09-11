'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Switch } from '../ui/Switch';
import { Mail, Save, Loader2, Play, Database, HardDrive, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useSettings } from '../providers/SettingsProvider';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export function DataBackupTab() {
  const { settings, updateSetting, refreshSettings } = useSettings();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [dbStatus, setDbStatus] = useState({ name: 'Carregando...', size: '...', isConnected: false });

  useEffect(() => {
    const fetchDbStatus = async () => {
      try {
        const response = await fetch('/api/db/status');
        if (response.ok) {
          const data = await response.json();
          setDbStatus(data);
        }
      } catch (error) {
        console.error('Error fetching db status:', error);
      }
    };
    fetchDbStatus();
  }, []);
  
  const smtpConfig = settings.smtp_config || {
    host: '',
    port: 587,
    user: '',
    password: '',
    secure: false,
    from_email: '',
  };

  const [localSmtpConfig, setLocalSmtpConfig] = useState(smtpConfig);
  const [sendToEmail, setSendToEmail] = useState(false);

  const handleOAuthConnect = async (provider: 'google' | 'outlook') => {
    try {
      const response = await fetch(`/api/auth/email/url?provider=${provider}`);
      const data = await response.json();
      
      if (data.error) {
        toast.error(`Erro: ${data.error}`);
        return;
      }
      
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      window.open(
        data.url,
        'oauth_popup',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (error) {
      console.error('OAuth Error:', error);
      toast.error('Erro ao iniciar conexão OAuth');
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_SUCCESS') {
        toast.success(`Conectado com sucesso: ${event.data.email}`);
        // Optionally update local state or refresh settings
        refreshSettings();
      } else if (event.data?.type === 'OAUTH_ERROR') {
        toast.error(`Erro na autenticação: ${event.data.error}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshSettings]);

  const handleSmtpChange = (field: string, value: any) => {
    setLocalSmtpConfig((prev: any) => ({ ...prev, [field]: value }));
  };

  const saveSmtpSettings = async () => {
    try {
      setLoading(true);
      await updateSetting('smtp_config', localSmtpConfig);
      toast.success('Configurações de e-mail salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar configurações.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const testSmtpConnection = async () => {
    try {
      setTestingConnection(true);
      const response = await fetch('/api/settings/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localSmtpConfig),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Conexão SMTP estabelecida com sucesso!');
      } else {
        const errorMessage = data.error || 'Erro desconhecido';
        
        // Check for common Outlook/Exchange authentication error
        if (errorMessage.includes('535 5.7.3') || errorMessage.includes('Authentication unsuccessful')) {
          toast.error(
            <div>
              <strong>Falha de Autenticação (Outlook/Exchange)</strong>
              <p className="text-xs mt-1">
                O servidor rejeitou a senha. Se você usa MFA (Autenticação em 2 Fatores), 
                você <strong>precisa</strong> usar uma &quot;Senha de Aplicativo&quot; (App Password) 
                em vez da sua senha normal.
              </p>
            </div>,
            { duration: 8000 } // Show for longer
          );
        } else {
          toast.error(`Falha na conexão: ${errorMessage}`);
        }
      }
    } catch (error) {
      toast.error('Erro ao testar conexão.');
      console.error(error);
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Database Status Card */}
      <Card
        title="Status do Banco de Dados"
        description="Informações sobre o estado atual do banco de dados."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div whileHover={{ scale: 1.02 }} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
            <Database className="h-6 w-6 text-indigo-500" />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Nome do Banco</p>
              <p className="text-sm font-medium text-slate-900">{dbStatus.name}</p>
            </div>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
            <HardDrive className="h-6 w-6 text-indigo-500" />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Tamanho</p>
              <p className="text-sm font-medium text-slate-900">{dbStatus.size}</p>
            </div>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
            {dbStatus.isConnected ? <CheckCircle className="h-6 w-6 text-emerald-500" /> : <AlertTriangle className="h-6 w-6 text-red-500" />}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Status da Conexão</p>
              <p className={`text-sm font-medium ${dbStatus.isConnected ? 'text-emerald-600' : 'text-red-600'}`}>
                {dbStatus.isConnected ? 'Conectado' : 'Desconectado'}
              </p>
            </div>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
            <Clock className="h-6 w-6 text-indigo-500" />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Último Backup</p>
              <p className="text-sm font-medium text-slate-900">
                {settings.backup_status 
                  ? (
                    <div className="flex flex-col">
                      <span>{new Date(settings.backup_status.last_backup_date).toLocaleString()}</span>
                      <span className={`text-xs font-bold ${settings.backup_status.status === 'SUCCESS' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {settings.backup_status.status === 'SUCCESS' ? 'SUCESSO' : `FALHA: ${settings.backup_status.error_message || 'Erro desconhecido'}`}
                      </span>
                    </div>
                  )
                  : 'Nenhum backup realizado'}
              </p>
            </div>
          </motion.div>
        </div>
      </Card>

      {/* Backup Scheduling Card */}
      <Card
        title="Agendamento de Back-Up"
        description="Configure os dias e horários para a realização automática dos backups do sistema."
      >
        <div className="space-y-6">
          <div className="sm:col-span-6 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-medium text-slate-900">Regras de Agendamento</h4>
              <button
                type="button"
                onClick={() => {
                  const currentSchedules = settings.backup_schedules || [];
                  updateSetting('backup_schedules', [...currentSchedules, { id: Date.now(), days: [], time: '02:00' }]);
                }}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Adicionar Regra
              </button>
            </div>
            
            <div className="space-y-4">
              {(settings.backup_schedules || []).map((schedule: any, index: number) => (
                <div key={schedule.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-slate-500 uppercase">Regra {index + 1}</label>
                    <button
                      onClick={() => {
                        const currentSchedules = settings.backup_schedules || [];
                        updateSetting('backup_schedules', currentSchedules.filter((s: any) => s.id !== schedule.id));
                      }}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remover
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, dIndex) => {
                      const dayIndex = dIndex.toString();
                      const isSelected = (schedule.days || []).includes(dayIndex);
                      return (
                        <button
                          key={dia}
                          type="button"
                          onClick={() => {
                            const currentSchedules = settings.backup_schedules || [];
                            const newSchedules = currentSchedules.map((s: any) => {
                              if (s.id === schedule.id) {
                                const newDays = isSelected 
                                  ? s.days.filter((d: string) => d !== dayIndex)
                                  : [...s.days, dayIndex];
                                return { ...s, days: newDays };
                              }
                              return s;
                            });
                            updateSetting('backup_schedules', newSchedules);
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {dia}
                        </button>
                      );
                    })}
                  </div>
                  
                  <input
                    type="time"
                    value={schedule.time}
                    onChange={(e) => {
                      const currentSchedules = settings.backup_schedules || [];
                      const newSchedules = currentSchedules.map((s: any) => 
                        s.id === schedule.id ? { ...s, time: e.target.value } : s
                      );
                      updateSetting('backup_schedules', newSchedules);
                    }}
                    className="block w-32 text-sm border-slate-300 rounded-md py-1 px-2 border"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="sm:col-span-6 flex items-center justify-end pt-4 border-t border-slate-100">
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  await updateSetting('backup_schedules', settings.backup_schedules);
                  toast.success('Configurações de backup salvas com sucesso!');
                } catch (error) {
                  toast.error('Erro ao salvar configurações.');
                  console.error(error);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </>
              )}
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

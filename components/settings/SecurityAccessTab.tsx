'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Switch } from '../ui/Switch';
import { Shield, Smartphone, Monitor, Trash2, AlertTriangle, Key, Clock, CheckCircle2 } from 'lucide-react';
import { useSettings } from '@/components/providers/SettingsProvider';

export function SecurityAccessTab() {
  const { settings, updateSetting } = useSettings();
  
  const [isIdleTimeoutEnabled, setIsIdleTimeoutEnabled] = useState(settings.session_timeout.enabled);
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(settings.session_timeout.minutes.toString());
  const [warningMinutes, setWarningMinutes] = useState(settings.session_timeout.warning_minutes.toString());
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsIdleTimeoutEnabled(settings.session_timeout.enabled);
    setIdleTimeoutMinutes(settings.session_timeout.minutes.toString());
    setWarningMinutes(settings.session_timeout.warning_minutes.toString());
  }, [settings]);

  const handleSavePolicies = async () => {
    setIsSaving(true);
    try {
      await updateSetting('session_timeout', {
        enabled: isIdleTimeoutEnabled,
        minutes: parseInt(idleTimeoutMinutes, 10),
        warning_minutes: parseInt(warningMinutes, 10)
      });
      
      // Reset last activity so the new timeout applies from now
      localStorage.setItem('session_last_activity', Date.now().toString());

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save security settings:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // ... rest of the component

  return (
    <div className="space-y-6">
      <Card
        title="Políticas de Sessão"
        description="Gerencie o tempo de vida das conexões dos usuários para garantir a segurança."
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Encerramento Automático por Inatividade</p>
                <p className="text-sm text-slate-600">Desconecta usuários ociosos automaticamente.</p>
              </div>
            </div>
            <Switch
              initialChecked={isIdleTimeoutEnabled}
              onChange={setIsIdleTimeoutEnabled}
            />
          </div>

          {isIdleTimeoutEnabled && (
            <div className="pl-13 pt-2 space-y-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="timeout" className="block text-sm font-medium text-slate-700">
                    Tempo limite de inatividade
                  </label>
                  <select
                    id="timeout"
                    value={idleTimeoutMinutes}
                    onChange={(e) => setIdleTimeoutMinutes(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border bg-white"
                  >
                    <option value="1">1 minuto (Teste)</option>
                    <option value="15">15 minutos</option>
                    <option value="30">30 minutos</option>
                    <option value="60">1 hora</option>
                    <option value="120">2 horas</option>
                    <option value="240">4 horas</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="warning" className="block text-sm font-medium text-slate-700">
                    Exibir aviso antes de desconectar
                  </label>
                  <select
                    id="warning"
                    value={warningMinutes}
                    onChange={(e) => setWarningMinutes(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border bg-white"
                  >
                    <option value="1">1 minuto antes</option>
                    <option value="5">5 minutos antes</option>
                    <option value="10">10 minutos antes</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end pt-2 gap-3">
                {showSuccess && (
                  <span className="flex items-center text-sm text-emerald-600 animate-in fade-in slide-in-from-right-2">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Salvo com sucesso!
                  </span>
                )}
                <button 
                  onClick={handleSavePolicies}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Políticas'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card
        title="Autenticação em Duas Etapas (2FA)"
        description="Adicione uma camada extra de segurança à sua conta exigindo um código de verificação."
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Aplicativo Autenticador</p>
              <p className="text-sm text-slate-600">Use o Google Authenticator ou Authy.</p>
            </div>
          </div>
          <button className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors">
            Configurar
          </button>
        </div>
      </Card>

      <Card
        title="Sessões Ativas"
        description="Gerencie os dispositivos que estão atualmente conectados à sua conta."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-indigo-200 bg-indigo-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Monitor className="h-6 w-6 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">Mac OS • Chrome <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">Atual</span></p>
                <p className="text-xs text-indigo-600">São Paulo, BR • IP: 192.168.1.1</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <Smartphone className="h-6 w-6 text-slate-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">iPhone 13 • Safari</p>
                <p className="text-xs text-slate-600">Rio de Janeiro, BR • Há 2 dias</p>
              </div>
            </div>
            <button className="text-sm text-rose-600 hover:text-rose-700 font-medium">
              Encerrar
            </button>
          </div>

          <div className="pt-2">
            <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              Encerrar todas as outras sessões
            </button>
          </div>
        </div>
      </Card>

      <Card
        title="Gestão de Perfis (RBAC)"
        description="Crie perfis de acesso personalizados para sua equipe."
      >
        <div className="space-y-4">
          <div className="p-4 border border-indigo-100 bg-indigo-50 rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <Shield className="h-6 w-6 text-indigo-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">Controle de Acesso Baseado em Perfis</p>
                <p className="text-xs text-slate-600">Gerencie permissões detalhadas para Advogados, Estagiários, Financeiro, etc.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              A ferramenta de Perfis e Permissões permite que você defina exatamente quais módulos e ações cada grupo de usuários pode realizar no sistema.
            </p>
            <button 
              onClick={() => {
                // This is a bit hacky but works since we are in the same parent component
                const profilesTabBtn = document.querySelector('button[id="profiles"]') as HTMLButtonElement;
                if (profilesTabBtn) profilesTabBtn.click();
              }}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Ir para Gestão de Perfis
            </button>
          </div>
        </div>
      </Card>

      <Card
        title="Zona de Perigo"
        description="Ações destrutivas e irreversíveis."
        danger={true}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Apagar registros antigos</p>
              <p className="text-sm text-slate-600">Exclui permanentemente dados com mais de 5 anos.</p>
            </div>
            <button className="px-3 py-1.5 text-sm font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors">
              Apagar Dados
            </button>
          </div>
          <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Zerar o Sistema</p>
              <p className="text-sm text-slate-600">Apaga todos os dados, mantendo apenas as configurações.</p>
            </div>
            <button className="px-3 py-1.5 text-sm font-medium text-white bg-rose-600 rounded-md hover:bg-rose-700 transition-colors">
              Zerar Sistema
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

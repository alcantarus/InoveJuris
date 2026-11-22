'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Switch } from '../ui/Switch';
import { Shield, Smartphone, Monitor, Trash2, AlertTriangle, Key, Clock, CheckCircle2 } from 'lucide-react';
import { useSettings } from '@/components/providers/SettingsProvider';
import {
  SESSION_TIMEOUT_MIN_SECONDS,
  SESSION_TIMEOUT_MAX_SECONDS,
  formatSessionDuration,
  normalizeSessionTimeout,
  toStoredSessionTimeout,
} from '@/lib/session-timeout';

type DurationUnit = 'seconds' | 'minutes';

function splitDuration(seconds: number): { value: string; unit: DurationUnit } {
  if (seconds >= 60 && seconds % 60 === 0) {
    return { value: String(seconds / 60), unit: 'minutes' };
  }
  return { value: String(seconds), unit: 'seconds' };
}

function parseDuration(value: string, unit: DurationUnit): number | null {
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(unit === 'minutes' ? parsed * 60 : parsed);
}

export function SecurityAccessTab() {
  const { settings, updateSetting } = useSettings();

  const initial = normalizeSessionTimeout(settings.session_timeout);
  const initialTimeout = splitDuration(initial.seconds);
  const initialWarning = splitDuration(initial.warningSeconds);

  const [isIdleTimeoutEnabled, setIsIdleTimeoutEnabled] = useState(initial.enabled);
  const [timeoutValue, setTimeoutValue] = useState(initialTimeout.value);
  const [timeoutUnit, setTimeoutUnit] = useState<DurationUnit>(initialTimeout.unit);
  const [warningValue, setWarningValue] = useState(initialWarning.value);
  const [warningUnit, setWarningUnit] = useState<DurationUnit>(initialWarning.unit);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const config = normalizeSessionTimeout(settings.session_timeout);
    const timeout = splitDuration(config.seconds);
    const warning = splitDuration(config.warningSeconds);

    setIsIdleTimeoutEnabled(config.enabled);
    setTimeoutValue(timeout.value);
    setTimeoutUnit(timeout.unit);
    setWarningValue(warning.value);
    setWarningUnit(warning.unit);
    setError('');
  }, [settings]);

  const timeoutSeconds = parseDuration(timeoutValue, timeoutUnit);
  const warningSeconds = parseDuration(warningValue, warningUnit);

  const handleSavePolicies = async () => {
    if (timeoutSeconds === null) {
      setError('Informe um tempo limite válido.');
      return;
    }
    if (timeoutSeconds < SESSION_TIMEOUT_MIN_SECONDS || timeoutSeconds > SESSION_TIMEOUT_MAX_SECONDS) {
      setError('O tempo limite deve ficar entre 30 segundos e 30 minutos.');
      return;
    }
    if (warningSeconds === null) {
      setError('Informe um tempo de aviso válido. Use 0 para desativar o aviso.');
      return;
    }
    if (warningSeconds >= timeoutSeconds) {
      setError('O aviso deve ser menor que o tempo limite de inatividade.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      await updateSetting(
        'session_timeout',
        toStoredSessionTimeout({
          enabled: isIdleTimeoutEnabled,
          seconds: timeoutSeconds,
          warningSeconds,
        })
      );

      // Reset last activity so the new timeout applies from now
      localStorage.setItem('session_last_activity', Date.now().toString());

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save security settings:', error);
      setError('Não foi possível salvar as políticas de sessão.');
    } finally {
      setIsSaving(false);
    }
  };

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
              checked={isIdleTimeoutEnabled}
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
                  <div className="mt-1 flex gap-2">
                    <input
                      id="timeout"
                      type="number"
                      min={timeoutUnit === 'minutes' ? 0.5 : SESSION_TIMEOUT_MIN_SECONDS}
                      max={timeoutUnit === 'minutes' ? 30 : SESSION_TIMEOUT_MAX_SECONDS}
                      step={timeoutUnit === 'minutes' ? 0.5 : 5}
                      value={timeoutValue}
                      onChange={(e) => setTimeoutValue(e.target.value)}
                      className="block w-full px-3 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border bg-white"
                    />
                    <select
                      aria-label="Unidade do tempo limite"
                      value={timeoutUnit}
                      onChange={(e) => setTimeoutUnit(e.target.value as DurationUnit)}
                      className="block w-32 px-2 py-2 text-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md border bg-white"
                    >
                      <option value="seconds">segundos</option>
                      <option value="minutes">minutos</option>
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    De 30 segundos a 30 minutos.
                    {timeoutSeconds !== null && timeoutSeconds >= SESSION_TIMEOUT_MIN_SECONDS && timeoutSeconds <= SESSION_TIMEOUT_MAX_SECONDS
                      ? ` Equivale a ${formatSessionDuration(timeoutSeconds)}.`
                      : ''}
                  </p>
                </div>

                <div>
                  <label htmlFor="warning" className="block text-sm font-medium text-slate-700">
                    Exibir aviso antes de desconectar
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="warning"
                      type="number"
                      min={0}
                      step={warningUnit === 'minutes' ? 0.5 : 5}
                      value={warningValue}
                      onChange={(e) => setWarningValue(e.target.value)}
                      className="block w-full px-3 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border bg-white"
                    />
                    <select
                      aria-label="Unidade do aviso"
                      value={warningUnit}
                      onChange={(e) => setWarningUnit(e.target.value as DurationUnit)}
                      className="block w-32 px-2 py-2 text-sm border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md border bg-white"
                    >
                      <option value="seconds">segundos</option>
                      <option value="minutes">minutos</option>
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    0 desativa o aviso. Deve ser menor que o tempo limite.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 text-sm text-rose-600">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </p>
          )}

          <div className="flex items-center justify-end pt-2 gap-3 border-t border-slate-100">
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

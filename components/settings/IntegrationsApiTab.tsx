'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Switch } from '../ui/Switch';
import { Mail, Webhook, Key, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSettings } from '@/components/providers/SettingsProvider';

export function IntegrationsApiTab() {
  const { settings, updateSetting } = useSettings();
  const [smtp, setSmtp] = useState({
    host: settings.smtp_config?.host || '',
    port: settings.smtp_config?.port?.toString() || '587',
    user: settings.smtp_config?.user || '',
    pass: settings.smtp_config?.password || settings.smtp_config?.pass || ''
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings.smtp_config) {
      setSmtp({
        host: settings.smtp_config.host || '',
        port: settings.smtp_config.port?.toString() || '587',
        user: settings.smtp_config.user || '',
        pass: settings.smtp_config.password || settings.smtp_config.pass || ''
      });
    }
  }, [settings.smtp_config]);

  const handleSaveSmtp = async () => {
    setIsSaving(true);
    try {
      await updateSetting('smtp_config', {
        ...settings.smtp_config,
        host: smtp.host,
        port: parseInt(smtp.port, 10),
        user: smtp.user,
        password: smtp.pass
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving SMTP settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Configuração de E-mail (SMTP)"
        description="Configure o servidor para envio de e-mails do sistema."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-8">
            <div>
              <label htmlFor="smtp-host" className="block text-sm font-medium text-slate-700">Servidor SMTP</label>
              <input 
                type="text" 
                id="smtp-host" 
                className="mt-1 block w-full sm:text-sm border-slate-300 rounded-md py-2 px-3 border focus:ring-indigo-500 focus:border-indigo-500 bg-white" 
                placeholder="smtp.gmail.com" 
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="smtp-port" className="block text-sm font-medium text-slate-700">Porta</label>
              <input 
                type="number" 
                id="smtp-port" 
                className="mt-1 block w-full sm:text-sm border-slate-300 rounded-md py-2 px-3 border focus:ring-indigo-500 focus:border-indigo-500 bg-white" 
                placeholder="587" 
                value={smtp.port}
                onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="smtp-user" className="block text-sm font-medium text-slate-700">Usuário</label>
              <input 
                type="text" 
                id="smtp-user" 
                className="mt-1 block w-full sm:text-sm border-slate-300 rounded-md py-2 px-3 border focus:ring-indigo-500 focus:border-indigo-500 bg-white" 
                placeholder="seuemail@empresa.com" 
                value={smtp.user}
                onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="smtp-pass" className="block text-sm font-medium text-slate-700">Senha</label>
              <input 
                type="password" 
                id="smtp-pass" 
                className="mt-1 block w-full sm:text-sm border-slate-300 rounded-md py-2 px-3 border focus:ring-indigo-500 focus:border-indigo-500 bg-white" 
                placeholder="••••••••" 
                value={smtp.pass}
                onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
              />
            </div>
          </div>
          <div className="pt-4 flex items-center justify-between border-t border-slate-100">
            <button className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors flex items-center">
              <Mail className="h-4 w-4 mr-2" />
              Enviar E-mail de Teste
            </button>
            <div className="flex items-center gap-3">
              {showSuccess && (
                <span className="flex items-center text-sm text-emerald-600 animate-in fade-in slide-in-from-right-2">
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Salvo!
                </span>
              )}
              <button 
                onClick={handleSaveSmtp}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Webhooks"
        description="Notifique sistemas externos quando eventos ocorrerem."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <Webhook className="h-6 w-6 text-slate-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">Nova Venda (Zapier)</p>
                <p className="text-xs text-slate-600">https://hooks.zapier.com/hooks/catch/123456/abcde/</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button className="text-sm text-slate-600 hover:text-slate-800">Editar</button>
              <Switch initialChecked={true} />
            </div>
          </div>
          <button className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
            + Adicionar Webhook
          </button>
        </div>
      </Card>

      <Card
        title="Chaves de API (API Keys)"
        description="Gerencie as chaves de acesso para integrações com o sistema."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <Key className="h-6 w-6 text-slate-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">Integração ERP Externo</p>
                <div className="flex items-center mt-1">
                  <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">sk_live_••••••••••••••••</code>
                  <button className="ml-2 text-slate-600 hover:text-slate-800">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-1">Criada em 01/01/2026 • Expira em 01/01/2027</p>
              </div>
            </div>
            <button className="text-sm text-rose-600 hover:text-rose-700 font-medium">
              Revogar
            </button>
          </div>
          <button className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
            + Gerar Nova Chave
          </button>
        </div>
      </Card>

      <Card
        title="Matriz de Notificações"
        description="Escolha como o sistema deve alertar sobre eventos importantes."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Evento</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">E-mail</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Sistema</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">SMS</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">Novo Usuário Cadastrado</td>
                <td className="px-6 py-4 whitespace-nowrap text-center"><input type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded" defaultChecked /></td>
                <td className="px-6 py-4 whitespace-nowrap text-center"><input type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded" defaultChecked /></td>
                <td className="px-6 py-4 whitespace-nowrap text-center"><input type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded" /></td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">Erro no Backup</td>
                <td className="px-6 py-4 whitespace-nowrap text-center"><input type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded" defaultChecked /></td>
                <td className="px-6 py-4 whitespace-nowrap text-center"><input type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded" defaultChecked /></td>
                <td className="px-6 py-4 whitespace-nowrap text-center"><input type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded" defaultChecked /></td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">Relatório Gerado</td>
                <td className="px-6 py-4 whitespace-nowrap text-center"><input type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded" /></td>
                <td className="px-6 py-4 whitespace-nowrap text-center"><input type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded" defaultChecked /></td>
                <td className="px-6 py-4 whitespace-nowrap text-center"><input type="checkbox" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

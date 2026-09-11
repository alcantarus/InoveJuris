'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Search, Filter, Download, User, Settings, Database, ShieldAlert, Clock, ArrowRight } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { removeAccents } from '@/lib/utils';

interface AuditLog {
  id: number;
  table_name: string;
  record_id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: any;
  new_data: any;
  changed_fields: any;
  performed_by: number | null;
  performed_at: string;
  performer_name?: string;
}

export function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const tableTranslations: Record<string, string> = {
    'users': 'Usuários',
    'clients': 'Clientes',
    'processes': 'Processos',
    'contracts': 'Contratos',
    'installments': 'Financeiro',
    'products': 'Produtos',
    'indicators': 'Indicadores',
    'bank_accounts': 'Contas Bancárias',
    'financial_categories': 'Categorias Financeiras',
    'financial_transactions': 'Fluxo de Caixa',
    'law_areas': 'Área do Direito'
  };

  const actionTranslations: Record<string, string> = {
    'INSERT': 'Inclusão',
    'UPDATE': 'Alteração',
    'DELETE': 'Exclusão'
  };

  useEffect(() => {
    const fetchLogs = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, performer:performed_by(name)')
        .order('performed_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching audit logs:', error);
      } else {
        const formattedLogs = data?.map((log: any) => ({
          ...log,
          performer_name: log.performer?.name || 'Sistema'
        })) || [];
        setLogs(formattedLogs);
      }
      setLoading(false);
    };

    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const table = tableTranslations[log.table_name] || log.table_name;
    const action = actionTranslations[log.action] || log.action;
    const search = removeAccents(searchTerm).toLowerCase();
    
    return removeAccents(table.toLowerCase()).includes(search) || 
           removeAccents(action.toLowerCase()).includes(search) || 
           removeAccents(log.performer_name?.toLowerCase() || '').includes(search);
  });

  return (
    <div className="space-y-6">
      <Card
        title="Logs de Auditoria"
        description="Rastreie todas as atividades importantes realizadas no sistema."
      >
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-600" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 px-3 border focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              placeholder="Buscar por usuário, ação ou tabela..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex space-x-2 w-full sm:w-auto">
            <button className="flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto">
              <Filter className="h-4 w-4 mr-2 text-slate-600" />
              Filtrar
            </button>
            <button className="flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2 text-slate-600" />
              Exportar
            </button>
          </div>
        </div>

        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          {loading ? (
            <div className="p-12 flex justify-center bg-white">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white">
              <Database className="mx-auto mb-3 text-slate-300" size={32} />
              <p>Nenhum registro de auditoria encontrado.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-300">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">Ação</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Tabela</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Usuário</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${
                        log.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700' :
                        log.action === 'UPDATE' ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {actionTranslations[log.action] || log.action}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-900 font-medium">
                      {tableTranslations[log.table_name] || log.table_name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        {log.performer_name}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-400" />
                        {new Date(log.performed_at).toLocaleString('pt-BR')}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Mostrando {filteredLogs.length} de {logs.length} registros recentes
          </p>
          <div className="flex items-center gap-4">
            <a 
              href="/auditoria" 
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Ver todos os logs
              <ArrowRight size={14} />
            </a>
            <div className="flex space-x-2">
              <button className="px-3 py-1 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>Anterior</button>
              <button className="px-3 py-1 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>Próxima</button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

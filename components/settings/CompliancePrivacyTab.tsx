'use client';

import { Card } from '../ui/Card';
import { Switch } from '../ui/Switch';
import { ShieldCheck, UserCheck, Download, Trash2, Search } from 'lucide-react';

export function CompliancePrivacyTab() {
  return (
    <div className="space-y-6">
      <Card
        title="Política de Retenção de Dados"
        description="Configure regras automáticas para exclusão ou anonimização de dados antigos, em conformidade com a LGPD."
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Apagar logs de auditoria antigos</p>
              <p className="text-sm text-slate-600">Mantém o banco de dados leve e seguro.</p>
            </div>
            <div className="flex items-center space-x-3">
              <select className="block w-32 sm:text-sm border-slate-300 rounded-md py-1.5 px-3 border focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                <option>6 meses</option>
                <option>1 ano</option>
                <option>2 anos</option>
                <option>Nunca</option>
              </select>
              <Switch initialChecked={true} />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Anonimizar clientes inativos</p>
              <p className="text-sm text-slate-600">Remove dados pessoais de clientes sem movimentação.</p>
            </div>
            <div className="flex items-center space-x-3">
              <select className="block w-32 sm:text-sm border-slate-300 rounded-md py-1.5 px-3 border focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                <option>1 ano</option>
                <option>3 anos</option>
                <option>5 anos</option>
                <option>Nunca</option>
              </select>
              <Switch initialChecked={false} />
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Ferramenta do Titular de Dados (LGPD)"
        description="Atenda às solicitações dos seus clientes para exportação ou exclusão de seus dados pessoais."
      >
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label htmlFor="search-user" className="block text-sm font-medium text-slate-700 mb-2">Buscar Cliente (CPF ou E-mail)</label>
            <div className="flex space-x-3">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-600" />
                </div>
                <input
                  type="text"
                  id="search-user"
                  className="block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 px-3 border focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ex: 123.456.789-00 ou cliente@email.com"
                />
              </div>
              <button className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Buscar
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 opacity-50 pointer-events-none">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">João da Silva</p>
                  <p className="text-xs text-slate-600">joao@email.com • 123.456.789-00</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                Cliente Ativo
              </span>
            </div>
            
            <div className="flex space-x-3 border-t border-slate-100 pt-4">
              <button className="flex-1 flex items-center justify-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
                <Download className="h-4 w-4 mr-2 text-slate-600" />
                Exportar Dados (.ZIP)
              </button>
              <button className="flex-1 flex items-center justify-center px-4 py-2 border border-rose-300 rounded-md shadow-sm text-sm font-medium text-rose-700 bg-white hover:bg-rose-50">
                <Trash2 className="h-4 w-4 mr-2 text-rose-400" />
                Excluir Conta
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-600 text-center">Busque um cliente para habilitar as opções de exportação e exclusão.</p>
        </div>
      </Card>
    </div>
  );
}

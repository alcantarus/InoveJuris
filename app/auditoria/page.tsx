'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { 
  Search, 
  Filter, 
  Clock, 
  Database, 
  User, 
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { removeAccents } from '@/lib/utils'

import { AuditAccessLogs } from '@/components/AuditAccessLogs'

interface AuditLog {
  id: number
  table_name: string
  record_id: number
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  old_data: any
  new_data: any
  changed_fields: any
  performed_by: number | null
  performed_at: string
  performer_name?: string
}

import { getAppEnv } from '@/lib/env'

export default function AuditoriaPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'data' | 'access'>('data')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [tableFilter, setTableFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)

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
  }

  const fieldTranslations: Record<string, string> = {
    'name': 'Nome',
    'email': 'E-mail',
    'role': 'Perfil',
    'status': 'Status',
    'phone': 'Telefone',
    'cpf': 'CPF',
    'rg': 'RG',
    'address': 'Endereço',
    'birth_date': 'Data de Nascimento',
    'law_area': 'Área do Direito',
    'lawArea': 'Área do Direito',
    'product_id': 'ID do Produto',
    'client_id': 'ID do Cliente',
    'contract_id': 'ID do Contrato',
    'amount': 'Valor',
    'amountPaid': 'Valor Pago',
    'amountReceivable': 'Valor a Receber',
    'amountReceived': 'Valor Recebido',
    'contractValue': 'Valor do Contrato',
    'contractDate': 'Data do Contrato',
    'dueDate': 'Data de Vencimento',
    'installmentNumber': 'Nº da Parcela',
    'paymentMethod': 'Forma de Pagamento',
    'processNumber': 'Nº do Processo',
    'isProBono': 'Pro Bono',
    'isFinanced': 'Financiado',
    'observations': 'Observações',
    'description': 'Descrição',
    'type': 'Tipo',
    'account_id': 'ID da Conta',
    'category_id': 'ID da Categoria',
    'date': 'Data',
    'initial_balance': 'Saldo Inicial',
    'current_balance': 'Saldo Atual',
    'environment': 'Ambiente',
    'created_at': 'Criado em',
    'updated_at': 'Atualizado em',
    'created_by': 'Criado por',
    'updated_by': 'Atualizado por'
  }

  const translateField = (field: string) => fieldTranslations[field] || field;

  useEffect(() => {
    const fetchLogs = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false)
        return
      }

      // Fetch logs
      const currentEnv = getAppEnv()
      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('environment', currentEnv)
        .order('performed_at', { ascending: false })
        .limit(100)

      if (tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter)
      }

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter)
      }

      const { data, error } = await query
      
      console.log('DEBUG: Audit Logs fetched:', data?.length);
      if (data && data.length > 0) {
        console.log('DEBUG: First log environment:', data[0].environment);
      }

      if (error) {
        console.error('Error fetching audit logs:', error)
      } else {
        const formattedLogs = data?.map((log: any) => ({
          ...log,
          performer_name: 'Sistema/Desconhecido'
        })) || []
        setLogs(formattedLogs)
      }
      setLoading(false)
    }

    fetchLogs()
  }, [tableFilter, actionFilter])

  const filteredLogs = logs.filter(log => {
    const translatedTable = tableTranslations[log.table_name] || log.table_name
    const term = removeAccents(searchTerm).toLowerCase()
    return removeAccents(translatedTable.toLowerCase()).includes(term) ||
      removeAccents(log.performer_name?.toLowerCase() || '').includes(term) ||
      removeAccents(JSON.stringify(log.changed_fields || {}).toLowerCase()).includes(term)
  })

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return <span className="text-slate-400 italic">nulo</span>
    if (typeof val === 'boolean') return val ? 'Sim' : 'Não'
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  const renderDiff = (log: AuditLog) => {
    if (log.action === 'INSERT') {
      return (
        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-sm">
          <h4 className="font-semibold text-emerald-800 mb-2">Dados Inseridos:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(log.new_data || {}).map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="text-xs font-medium text-emerald-600 uppercase">{translateField(key)}</span>
                <span className="text-slate-700">{formatValue(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (log.action === 'DELETE') {
      return (
        <div className="bg-rose-50 p-4 rounded-lg border border-rose-100 text-sm">
          <h4 className="font-semibold text-rose-800 mb-2">Dados Excluídos:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(log.old_data || {}).map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="text-xs font-medium text-rose-600 uppercase">{translateField(key)}</span>
                <span className="text-slate-700">{formatValue(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // UPDATE
    const changes = log.changed_fields || {}
    return (
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
        <h4 className="font-semibold text-slate-700 mb-2">Alterações Realizadas:</h4>
        <div className="space-y-3">
          {Object.keys(changes).map((key) => (
            <div key={key} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 bg-white p-3 rounded border border-slate-100">
              <div className="w-full md:w-1/3">
                <span className="text-xs font-bold text-slate-500 uppercase block">{translateField(key)}</span>
              </div>
              <div className="flex-1 flex flex-col md:flex-row items-start md:items-center gap-2 overflow-hidden w-full">
                <div className="w-full md:flex-1 bg-rose-50 px-2 py-1 rounded text-rose-700 line-through decoration-rose-300 break-all">
                  {formatValue(log.old_data?.[key])}
                </div>
                <ArrowRight size={14} className="text-slate-400 hidden md:block shrink-0" />
                <div className="w-full md:flex-1 bg-emerald-50 px-2 py-1 rounded text-emerald-700 font-medium break-all">
                  {formatValue(log.new_data?.[key])}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <ModuleHeader 
          icon={Database}
          title="Auditoria do Sistema" 
          description="Rastreabilidade completa de todas as ações realizadas no sistema."
        />

        {!isSupabaseConfigured && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800">
            <AlertTriangle className="text-amber-500 shrink-0" size={20} />
            <p className="text-sm">
              <strong>Supabase não configurado:</strong> Os logs de auditoria não podem ser visualizados sem a conexão com o banco de dados.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-200 mb-6">
          <button
            className={`whitespace-nowrap px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'data'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            onClick={() => setActiveTab('data')}
          >
            Logs de Dados
          </button>
          <button
            className={`whitespace-nowrap px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'access'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
            onClick={() => setActiveTab('access')}
          >
            Acessos do Sistema
          </button>
        </div>

        {activeTab === 'data' ? (
          <>
            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por tabela, usuário ou campo alterado..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <select 
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
            >
              <option value="all">Todas as Tabelas</option>
              <option value="clients">Clientes</option>
              <option value="processes">Processos</option>
              <option value="contracts">Contratos</option>
              <option value="installments">Financeiro</option>
              <option value="products">Produtos</option>
              <option value="law_areas">Área do Direito</option>
              <option value="indicators">Indicadores</option>
              <option value="bank_accounts">Contas Bancárias</option>
              <option value="financial_categories">Categorias Financeiras</option>
              <option value="financial_transactions">Fluxo de Caixa</option>
              <option value="users">Usuários</option>
            </select>

            <select 
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">Todas as Ações</option>
              <option value="INSERT">Inclusão</option>
              <option value="UPDATE">Alteração</option>
              <option value="DELETE">Exclusão</option>
            </select>
          </div>
        </div>

        {/* Logs List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Database className="mx-auto mb-3 text-slate-300" size={32} />
              <p>Nenhum registro de auditoria encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <div key={log.id} className="group">
                  <div 
                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between"
                    onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        log.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700' :
                        log.action === 'UPDATE' ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {log.action === 'INSERT' && <div className="font-bold text-xs">INC</div>}
                        {log.action === 'UPDATE' && <div className="font-bold text-xs">ALT</div>}
                        {log.action === 'DELETE' && <div className="font-bold text-xs">EXC</div>}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{tableTranslations[log.table_name] || log.table_name}</span>
                          <span className="text-slate-400 text-xs">#{log.record_id}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-0.5">
                          <User size={12} />
                          <span>{log.performer_name}</span>
                          <span>•</span>
                          <Clock size={12} />
                          <span>{new Date(log.performed_at).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-slate-400">
                      {expandedLogId === log.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>

                  {expandedLogId === log.id && (
                    <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2 duration-200">
                      <div className="pl-14">
                        {renderDiff(log)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        ) : (
          <AuditAccessLogs />
        )}
      </div>
    </DashboardLayout>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { Modal } from '@/components/Modal'
import { KPICard } from '@/components/ui/KPICard'
import { DollarSign, Search, Calendar, CheckCircle2, Clock, AlertCircle, Plus, Receipt, Download, FileText, History, Eye, EyeOff } from 'lucide-react'
import { motion } from 'motion/react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, getStatusColor, getRowColor, cn, getTodayBR, isContractQuitado } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { CurrencyInput } from '@/components/CurrencyInput'
import { usePrivacy } from '@/components/providers/PrivacyProvider'

export default function ContasAReceberPage() {
  const { isVisible, toggleVisibility } = usePrivacy()
  const [contracts, setContracts] = useState<any[]>([])
  const [selectedContract, setSelectedContract] = useState<any>(null)
  const [installments, setInstallments] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [financialCategories, setFinancialCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedInstallments, setSelectedInstallments] = useState<number[]>([])
  const [receiveModalOpen, setReceiveModalOpen] = useState(false)
  const [prorogueModalOpen, setProrogueModalOpen] = useState(false)
  const [reverseModalOpen, setReverseModalOpen] = useState(false)
  const [estornoReason, setEstornoReason] = useState('')
  const [estornoAccountId, setEstornoAccountId] = useState('')
  const [activeInstallment, setActiveInstallment] = useState<any>(null)
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [receiveAmount, setReceiveAmount] = useState(0)
  const [paymentAccount, setPaymentAccount] = useState('')
  const [paymentCategory, setPaymentCategory] = useState('')
  const [paymentDescription, setPaymentDescription] = useState('')
  const [prorogueDate, setProrogueDate] = useState('')
  const [filterType, setFilterType] = useState('Todos') // 'Todos', 'Abertos', 'Quitados', 'Atrasados', 'Vence Hoje'
  const { user } = useAuth()
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'client_name', direction: 'asc' });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <span className="ml-1 text-slate-300">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="ml-1 text-indigo-600">↑</span> : <span className="ml-1 text-indigo-600">↓</span>;
  };

  const sortedContracts = React.useMemo(() => {
    let sortableContracts = [...contracts];
    if (sortConfig !== null) {
      sortableContracts.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle specific fields
        if (sortConfig.key === 'client_name') {
          aValue = a.client_name || '';
          bValue = b.client_name || '';
        } else if (sortConfig.key === 'contract_value') {
          aValue = Number(a.contract_value || 0);
          bValue = Number(b.contract_value || 0);
        } else if (sortConfig.key === 'amount_received') {
          aValue = Number(a.amount_received || 0);
          bValue = Number(b.amount_received || 0);
        } else if (sortConfig.key === 'amount_to_receive') {
          aValue = Number(a.amount_to_receive || 0);
          bValue = Number(b.amount_to_receive || 0);
        } else if (sortConfig.key === 'next_due_date') {
          aValue = a.next_due_date || '';
          bValue = b.next_due_date || '';
        } else if (sortConfig.key === 'contract_status') {
          aValue = a.contract_status || '';
          bValue = b.contract_status || '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableContracts;
  }, [contracts, sortConfig]);

  const exportToCSV = () => {
    const dataToExport = !selectedContract ? contracts : installments;
    if (dataToExport.length === 0) {
      toast.error('Não há dados para exportar');
      return;
    }

    const headers = !selectedContract 
      ? ['Cliente', 'Processo', 'Valor Contrato', 'Recebido', 'A Receber', 'Próx. Vencimento', 'Situação']
      : ['Parcela', 'Vencimento', 'Valor', 'Pago', 'Saldo', 'Status'];

    const rows = !selectedContract
      ? dataToExport.map(c => [
          `"${c.client_name || ''}"`,
          `"${c.processNumber || ''}"`,
          c.contract_value || 0,
          c.amount_received || 0,
          c.amount_to_receive || 0,
          c.next_due_date ? formatDate(c.next_due_date) : '',
          c.contract_status || ''
        ])
      : dataToExport.map(i => [
          i.installmentNumber,
          formatDate(i.dueDate),
          i.amount || 0,
          i.amountPaid || 0,
          (i.amount || 0) - (i.amountPaid || 0),
          i.status || ''
        ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `exportacao_contas_receber_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cancelContract = async () => {
    if (!selectedContract) return;

    const reason = prompt('Motivo do cancelamento:');
    if (!reason) return;

    setLoading(true);
    try {
      if (!user?.id) {
        toast.error('Usuário não autenticado');
        setLoading(false);
        return;
      }
      const payload = {
        p_contract_id: Number(selectedContract.id),
        p_reason: reason,
        p_user_id: Number(user.id)
      };
      console.log('Calling RPC process_contract_cancellation with payload:', payload);

      const { error: rpcError, data } = await supabase.rpc('process_contract_cancellation', payload, { schema: 'public' });

      if (rpcError) {
        console.error('RPC error details:', JSON.stringify(rpcError, null, 2));
        throw rpcError;
      }
      
      console.log('RPC success data:', data);

      toast.success('Contrato cancelado com sucesso!');
      setSelectedContract(null);
      fetchContracts();
    } catch (error) {
      toast.error('Erro ao cancelar contrato');
      console.error('Full error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPayment = async () => {
    if (selectedInstallments.length === 0 || !user) return;

    if (!confirm(`Deseja processar o recebimento total de ${selectedInstallments.length} parcelas selecionadas?`)) {
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const installmentId of selectedInstallments) {
      const installment = installments.find(i => i.id === installmentId);
      if (!installment) continue;

      try {
        const { error } = await supabase.rpc('process_installment_payment', {
          p_installment_id: installmentId,
          p_amount_paid: installment.amount - (installment.amountPaid || 0),
          p_payment_method: 'Outros',
          p_bank_account_id: null,
          p_user_id: user.id
        });

        if (error) throw error;
        successCount++;
      } catch (err) {
        console.error(`Error processing installment ${installmentId}:`, err);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} parcelas recebidas com sucesso!`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} parcelas falharam no processamento.`);
    }

    setSelectedInstallments([]);
    if (selectedContract) {
      fetchInstallmentsForContract(selectedContract.id);
    }
    fetchContracts();
    setLoading(false);
  };

  const openReceiveModal = async (inst: any) => {
    setActiveInstallment(inst)
    setReceiveAmount(inst.amount - (inst.amountPaid || 0))
    
    // Buscar histórico de pagamentos
    const { data } = await supabase
      .from('payments')
      .select('*, bank_accounts(name), financial_categories(name)')
      .eq('installment_id', inst.id)
      .order('payment_date', { ascending: false })
    
    setPaymentHistory(data || [])
    setReceiveModalOpen(true)
  }

  const openProrogueModal = (inst: any) => {
    setActiveInstallment(inst)
    setProrogueModalOpen(true)
  }

  const openReverseModal = (inst: any) => {
    setActiveInstallment(inst)
    setReverseModalOpen(true)
  }

  const toggleSelection = (id: number) => {
    setSelectedInstallments(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const fetchLookups = React.useCallback(async () => {
    const [accountsRes, categoriesRes] = await Promise.all([
      supabase.from('bank_accounts').select('id, name'),
      supabase.from('financial_categories').select('id, name').eq('type', 'income')
    ])
    if (accountsRes.data) setBankAccounts(accountsRes.data)
    if (categoriesRes.data) setFinancialCategories(categoriesRes.data)
  }, [])

  const fetchContracts = React.useCallback(async () => {
    setLoading(true)
    const { data: summaryData, error: summaryError } = await supabase
      .from('contract_receivables_summary')
      .select(`*`)
      .order('processNumber', { ascending: true })

    if (summaryError) {
      toast.error('Erro ao buscar contratos')
      console.error(summaryError)
      setLoading(false)
      return
    }

    const { data: contractsData, error: contractsError } = await supabase
      .from('contracts')
      .select('id, isProBono, isFinanced')

    if (contractsError) {
      console.error('Erro ao buscar detalhes dos contratos:', contractsError)
      setContracts(summaryData || [])
    } else {
      const mergedData = summaryData?.map((s: any) => ({
        ...s,
        contracts: contractsData.find((c: any) => c.id === s.contract_id)
      }))
      console.log('Merged Data:', mergedData);
      setContracts(mergedData || [])
    }
    setLoading(false)
  }, [])

  const fetchInstallmentsForContract = React.useCallback(async (contractId: number) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('installments')
      .select(`*`)
      .eq('contract_id', contractId)
      .order('dueDate', { ascending: true })

    if (error) {
      toast.error('Erro ao buscar parcelas')
      console.error(error)
    } else {
      setInstallments(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchContracts()
    fetchLookups()
  }, [fetchContracts, fetchLookups])

  useEffect(() => {
    if (selectedContract) {
      fetchInstallmentsForContract(selectedContract.id)
    }
  }, [selectedContract, fetchInstallmentsForContract])

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <ModuleHeader
          icon={Receipt}
          title="Contas a Receber"
          description="Gestão de recebimentos, parcelas e estornos."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
            title="Total a Receber" 
            value={formatCurrency(contracts.filter(c => c.contract_status !== 'Cancelado' && c.contract_status !== 'Quitado').reduce((acc, c) => acc + Number(c.amount_to_receive || 0), 0))} 
            icon={DollarSign} 
            color="indigo" 
            isVisible={isVisible('receivable_total')}
            onToggleVisibility={() => toggleVisibility('receivable_total')}
          />
          <KPICard 
            title="Total em Atraso" 
            value={formatCurrency(contracts.filter(c => c.contract_status !== 'Cancelado' && c.contract_status !== 'Quitado' && c.next_due_date && c.next_due_date < getTodayBR()).reduce((acc, c) => acc + Number(c.amount_to_receive || 0), 0))} 
            icon={AlertCircle} 
            color="rose" 
            isVisible={isVisible('receivable_overdue')}
            onToggleVisibility={() => toggleVisibility('receivable_overdue')}
          />
          <KPICard 
            title="Recebido este Mês" 
            value={formatCurrency(0, isVisible('receivable_monthly'))} 
            icon={CheckCircle2} 
            color="emerald" 
            isVisible={isVisible('receivable_monthly')}
            onToggleVisibility={() => toggleVisibility('receivable_monthly')}
          />
          <KPICard 
            title="Previsão (30d)" 
            value={formatCurrency(0, isVisible('receivable_forecast'))} 
            icon={Calendar} 
            color="amber" 
            isVisible={isVisible('receivable_forecast')}
            onToggleVisibility={() => toggleVisibility('receivable_forecast')}
          />
        </div>
        <div className="flex gap-2">
          <button className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2">
            <Plus size={20} />
            Novo Título
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign /></div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-500">Total Recebido</p>
                <button 
                  onClick={() => toggleVisibility('receivable_summary_received')} 
                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {isVisible('receivable_summary_received') ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
              <p className="text-2xl font-bold">
                {formatCurrency(
                  !selectedContract 
                    ? contracts.reduce((acc, c) => acc + Number(c.amount_received || 0), 0)
                    : installments.reduce((acc, i) => acc + Number(i.amountPaid || 0), 0),
                  isVisible('receivable_summary_received')
                )}
              </p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Clock /></div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-500">A Receber</p>
                <button 
                  onClick={() => toggleVisibility('receivable_summary_to_receive')} 
                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {isVisible('receivable_summary_to_receive') ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
              <p className="text-2xl font-bold">
                {formatCurrency(
                  !selectedContract 
                    ? contracts
                        .filter(c => c.contract_status !== 'Cancelado' && c.contract_status !== 'Quitado')
                        .reduce((acc, c) => acc + Number(c.amount_to_receive || 0), 0)
                    : installments
                        .filter(i => i.status !== 'Quitado' && i.status !== 'Cancelada')
                        .reduce((acc, i) => acc + (Number(i.amount) - Number(i.amountPaid || 0)), 0),
                  isVisible('receivable_summary_to_receive')
                )}
              </p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-slate-50 text-slate-600 rounded-xl"><CheckCircle2 /></div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-slate-500">Total de Parcelas</p>
                <button 
                  onClick={() => toggleVisibility('receivable_summary_total_installments')} 
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {isVisible('receivable_summary_total_installments') ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
              <p className="text-2xl font-bold">
                {isVisible('receivable_summary_total_installments') ? (!selectedContract ? contracts.length : installments.length) : '••••••'}
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative w-full md:max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por cliente ou processo..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button 
              onClick={() => setFilterType('Todos')}
              className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors border", filterType === 'Todos' ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}
            >
              Todos
            </button>
            <button 
              onClick={() => setFilterType('Abertos')}
              className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors border", filterType === 'Abertos' ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}
            >
              Abertos
            </button>
            <button 
              onClick={() => setFilterType('Quitados')}
              className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors border", filterType === 'Quitados' ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}
            >
              Quitados
            </button>
            <button 
              onClick={() => setFilterType('Atrasados')}
              className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors border", filterType === 'Atrasados' ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}
            >
              Atrasados
            </button>
            <button 
              onClick={() => setFilterType('Vence Hoje')}
              className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors border", filterType === 'Vence Hoje' ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}
            >
              Vence Hoje
            </button>
            <button 
              onClick={exportToCSV}
              className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 ml-auto md:ml-2"
            >
              <Download size={16} />
              Exportar
            </button>
          </div>
        </div>
        
        {!selectedContract ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[800px]">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs">
                <tr>
                  <th className="p-4 cursor-pointer" onClick={() => handleSort('client_name')}>Cliente / Processo <SortIcon columnKey="client_name" /></th>
                  <th className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer" onClick={() => handleSort('contract_value')}>
                      Valor Contrato <SortIcon columnKey="contract_value" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleVisibility('receivable_table_value'); }} 
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors ml-1"
                        title={isVisible('receivable_table_value') ? "Ocultar valor" : "Mostrar valor"}
                      >
                        {isVisible('receivable_table_value') ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                    </div>
                  </th>
                  <th className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer" onClick={() => handleSort('amount_received')}>
                      Recebido <SortIcon columnKey="amount_received" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleVisibility('receivable_table_received'); }} 
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors ml-1"
                        title={isVisible('receivable_table_received') ? "Ocultar valor" : "Mostrar valor"}
                      >
                        {isVisible('receivable_table_received') ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                    </div>
                  </th>
                  <th className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer" onClick={() => handleSort('amount_to_receive')}>
                      A Receber <SortIcon columnKey="amount_to_receive" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleVisibility('receivable_table_to_receive'); }} 
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors ml-1"
                        title={isVisible('receivable_table_to_receive') ? "Ocultar valor" : "Mostrar valor"}
                      >
                        {isVisible('receivable_table_to_receive') ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                    </div>
                  </th>
                  <th className="p-4 cursor-pointer" onClick={() => handleSort('next_due_date')}>Próx. Vencimento <SortIcon columnKey="next_due_date" /></th>
                  <th className="p-4 cursor-pointer" onClick={() => handleSort('contract_status')}>Situação <SortIcon columnKey="contract_status" /></th>
                  <th className="p-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="p-4 text-center">Carregando...</td></tr>
                ) : sortedContracts.filter(c => {
                  const matchesSearch = c.processNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || c.client_name?.toLowerCase().includes(searchTerm.toLowerCase());
                  if (!matchesSearch) return false;
                  const today = getTodayBR();
                  if (filterType === 'Abertos') return c.contract_status !== 'Quitado' && c.contract_status !== 'Cancelado';
                  if (filterType === 'Quitados') return c.contract_status === 'Quitado';
                  if (filterType === 'Atrasados') return c.next_due_date && c.next_due_date < today && c.contract_status !== 'Quitado' && c.contract_status !== 'Cancelado';
                  if (filterType === 'Vence Hoje') return c.next_due_date && c.next_due_date === today && c.contract_status !== 'Quitado' && c.contract_status !== 'Cancelado';
                  return true;
                }).map((c, index) => {
                  let rowStatus = c.contract_status || 'Normal';
                  if (rowStatus === 'Aberto') rowStatus = 'Normal';
                  
                  if (rowStatus !== 'Cancelado' && rowStatus !== 'Estornado' && rowStatus !== 'Prorrogado') {
                    if (c.contracts?.isProBono) rowStatus = 'Pro Bono';
                    else if (rowStatus === 'Quitado') rowStatus = 'Quitado';
                    else if (c.contracts?.isFinanced) rowStatus = 'Financiado';
                    else rowStatus = 'Normal';
                  }
                  
                  return (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={c.contract_id} 
                    className={cn("transition-colors", getRowColor(rowStatus))}
                  >
                    <td className="p-4">
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        {c.client_name}
                        {c.contracts?.isProBono && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                            Pro Bono
                          </span>
                        )}
                        {c.contracts?.isFinanced && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-100 text-cyan-800 border border-cyan-200">
                            Financiado
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{c.processNumber}</div>
                    </td>
                    <td className="p-4 text-right text-slate-900">{formatCurrency(c.contract_value, isVisible('receivable_table_value'))}</td>
                    <td className="p-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-emerald-600">{formatCurrency(c.amount_received, isVisible('receivable_table_received'))}</span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${Math.min((c.amount_received / (c.contract_value || 1)) * 100, 100)}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right text-slate-600">{formatCurrency(c.amount_to_receive, isVisible('receivable_table_to_receive'))}</td>
                    <td className="p-4 text-slate-600">{c.next_due_date ? formatDate(c.next_due_date) : '-'}</td>
                    <td className="p-4">
                      <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", getStatusColor(rowStatus), c.contract_status?.toLowerCase() === 'cancelado' && "line-through")}>
                        {c.contract_status}
                      </span>
                    </td>
                    <td className="p-4">
                      <button className="text-indigo-600 hover:text-indigo-800 font-medium text-xs uppercase tracking-wider" onClick={() => setSelectedContract({ id: c.contract_id, processNumber: c.processNumber, clients: { name: c.client_name }, status: c.contract_status })}>Ver Parcelas</button>
                    </td>
                  </motion.tr>
                )})}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-6">
            <button className="text-slate-500 hover:text-slate-700 flex items-center gap-1" onClick={() => setSelectedContract(null)}>&larr; Voltar para Contratos</button>
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-lg font-bold break-all">Contrato: {selectedContract.processNumber} - {selectedContract.clients?.name}</h2>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {selectedInstallments.length > 0 && (
                  <button 
                    className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
                    onClick={handleBatchPayment}
                  >
                    Receber Selecionados ({selectedInstallments.length})
                  </button>
                )}
                <button 
                  className={cn(
                    "flex-1 md:flex-none px-4 py-2 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
                    (selectedContract.status === 'Cancelado' || isContractQuitado(selectedContract.status, selectedContract.contractValue, selectedContract.amountReceived) || installments.some(i => Number(i.amountPaid || 0) > 0)) ? "bg-slate-400" : "bg-rose-600 hover:bg-rose-700"
                  )}
                  onClick={cancelContract}
                  disabled={selectedContract.status === 'Cancelado' || isContractQuitado(selectedContract.status, selectedContract.contractValue, selectedContract.amountReceived) || installments.some(i => Number(i.amountPaid || 0) > 0)}
                >
                  Cancelar Contrato
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[800px]">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs">
                  <tr>
                    <th className="p-4 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                        checked={selectedInstallments.length === installments.filter(i => i.status !== 'Quitado' && i.status !== 'Cancelada').length && installments.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInstallments(installments.filter(i => i.status !== 'Quitado' && i.status !== 'Cancelada').map(i => i.id))
                          } else {
                            setSelectedInstallments([])
                          }
                        }}
                      />
                    </th>
                    <th className="p-4">Parcela</th>
                    <th className="p-4">Vencimento</th>
                    <th className="p-4">
                      <div className="flex items-center gap-1">
                        Valor
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleVisibility('receivable_installment_value'); }} 
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors ml-1"
                          title={isVisible('receivable_installment_value') ? "Ocultar valor" : "Mostrar valor"}
                        >
                          {isVisible('receivable_installment_value') ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                      </div>
                    </th>
                    <th className="p-4">
                      <div className="flex items-center gap-1">
                        Pago
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleVisibility('receivable_installment_paid'); }} 
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors ml-1"
                          title={isVisible('receivable_installment_paid') ? "Ocultar valor" : "Mostrar valor"}
                        >
                          {isVisible('receivable_installment_paid') ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                      </div>
                    </th>
                    <th className="p-4">
                      <div className="flex items-center gap-1">
                        A Receber
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleVisibility('receivable_installment_balance'); }} 
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors ml-1"
                          title={isVisible('receivable_installment_balance') ? "Ocultar valor" : "Mostrar valor"}
                        >
                          {isVisible('receivable_installment_balance') ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                      </div>
                    </th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={8} className="p-4 text-center">Carregando...</td></tr>
                  ) : installments.map((i, index) => {
                    const today = getTodayBR();
                    const isLate = i.dueDate < today && i.status !== 'Quitado' && i.status !== 'Cancelada';
                    const daysLate = isLate ? Math.floor((new Date(today).getTime() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    
                    return (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={i.id} 
                      className={cn("hover:bg-slate-50 transition-colors", (selectedContract.status?.toLowerCase() === 'cancelado' || i.status?.toLowerCase() === 'cancelada') && "bg-rose-50 line-through text-slate-400")}
                    >
                      <td className="p-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50" 
                          checked={selectedInstallments.includes(i.id)} 
                          disabled={i.status === 'Quitado' || i.status === 'Cancelada'}
                          onChange={() => toggleSelection(i.id)} 
                        />
                      </td>
                      <td className="p-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {i.installmentNumber}
                          {isLate && (
                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", daysLate > 30 ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-700")}>
                              {daysLate} dias atraso
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">{formatDate(i.dueDate)}</td>
                      <td className="p-4 text-slate-900 font-medium">{formatCurrency(i.amount, isVisible('receivable_installment_value'))}</td>
                      <td className="p-4 text-slate-600">{formatCurrency(i.amountPaid || 0, isVisible('receivable_installment_paid'))}</td>
                      <td className="p-4 text-emerald-600 font-bold">{formatCurrency(i.status === 'Quitado' ? 0 : (i.amount - (i.amountPaid || 0)), isVisible('receivable_installment_balance'))}</td>
                      <td className="p-4">
                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", getStatusColor(i.status), i.status?.toLowerCase() === 'cancelada' && "line-through")}>
                          {i.status}
                        </span>
                      </td>
                      <td className="p-4 flex gap-3">
                        <button 
                          className={cn("text-emerald-600 hover:text-emerald-800 font-medium text-xs uppercase tracking-wider disabled:text-slate-300", (i.status === 'Quitado' || i.status?.toLowerCase() === 'cancelada') && "pointer-events-none")}
                          disabled={i.status === 'Quitado' || i.status?.toLowerCase() === 'cancelada'}
                          onClick={() => openReceiveModal(i)}
                        >
                          Receber
                        </button>
                        <button 
                          className={cn("text-amber-600 hover:text-amber-800 font-medium text-xs uppercase tracking-wider disabled:text-slate-300", (i.status === 'Quitado' || i.status?.toLowerCase() === 'cancelada') && "pointer-events-none")}
                          disabled={i.status === 'Quitado' || i.status?.toLowerCase() === 'cancelada'}
                          onClick={() => openProrogueModal(i)}
                        >
                          Prorrogar
                        </button>
                        <button 
                          className={cn("text-rose-600 hover:text-rose-800 font-medium text-xs uppercase tracking-wider disabled:text-slate-300", ((i.status !== 'Quitado' && i.status !== 'Parcial') || Number(i.amountPaid || 0) <= 0) && "pointer-events-none")}
                          disabled={i.status !== 'Quitado' && i.status !== 'Parcial' || Number(i.amountPaid || 0) <= 0}
                          onClick={() => openReverseModal(i)}
                        >
                          Estornar
                        </button>
                      </td>
                    </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        <Modal isOpen={receiveModalOpen} onClose={() => setReceiveModalOpen(false)} title="Receber Parcela">
          {activeInstallment && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">Parcela: {activeInstallment.installmentNumber}</p>
                <p className="font-bold text-lg">{selectedContract.clients?.name}</p>
                <div className="flex justify-between mt-2 text-sm">
                  <span>Valor Original: {formatCurrency(activeInstallment.amount, isVisible('receivable_installment_value'))}</span>
                  <span className="font-bold text-emerald-600">Saldo: {formatCurrency(activeInstallment.amount - (activeInstallment.amountPaid || 0), isVisible('receivable_installment_balance'))}</span>
                </div>
              </div>

              {paymentHistory.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-700">Histórico de Pagamentos</h3>
                  <div className="bg-slate-50 rounded-lg divide-y divide-slate-200">
                    {paymentHistory.map((p) => (
                      <div key={p.id} className="p-3 text-sm flex justify-between">
                        <span>{formatDate(p.payment_date)} - {p.description || 'Pagamento'}</span>
                        <span className="font-medium">{formatCurrency(p.amount, isVisible('receivable_installment_paid'))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor a Receber</label>
                  <CurrencyInput value={receiveAmount} onChange={setReceiveAmount} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Conta</label>
                  <select value={paymentAccount} onChange={(e) => setPaymentAccount(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20">
                    <option value="">Selecione uma conta</option>
                    {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                  <select value={paymentCategory} onChange={(e) => setPaymentCategory(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20">
                    <option value="">Selecione uma categoria</option>
                    {financialCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                  <input type="text" value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                <button className="w-full bg-emerald-600 text-white p-3 rounded-lg font-bold hover:bg-emerald-700 transition" onClick={async () => {
                  const { error } = await supabase.rpc('process_installment_payment', {
                    p_installment_id: activeInstallment.id,
                    p_amount_paid: receiveAmount,
                    p_date: getTodayBR(),
                    p_interest: 0,
                    p_fine: 0,
                    p_description: paymentDescription,
                    p_account_id: paymentAccount,
                    p_category_id: paymentCategory,
                    p_user_id: user?.id
                  })
                  if (error) {
                    toast.error('Erro ao processar pagamento')
                    console.error(error)
                  } else {
                    toast.success('Pagamento processado com sucesso!')
                    setReceiveModalOpen(false)
                    fetchInstallmentsForContract(selectedContract.id)
                  }
                }}>Confirmar Recebimento</button>
              </div>
            </div>
          )}
        </Modal>

        <Modal isOpen={prorogueModalOpen} onClose={() => setProrogueModalOpen(false)} title="Prorrogar Parcela">
          {activeInstallment && (
            <div className="space-y-4">
              <p>Parcela: {activeInstallment.installmentNumber} - {selectedContract.clients?.name}</p>
              <label className="block text-sm font-medium text-slate-700">Nova Data de Vencimento</label>
              <input type="date" value={prorogueDate} onChange={(e) => setProrogueDate(e.target.value)} className="w-full p-2 border rounded-lg" />
              <button className="w-full bg-amber-600 text-white p-2 rounded-lg" onClick={async () => {
                const { error } = await supabase
                  .from('installments')
                  .update({ dueDate: prorogueDate, status: 'Prorrogada' })
                  .eq('id', activeInstallment.id)
                if (error) {
                  toast.error('Erro ao prorrogar parcela')
                  console.error(error)
                } else {
                  toast.success('Parcela prorrogada com sucesso!')
                  setProrogueModalOpen(false)
                  fetchInstallmentsForContract(selectedContract.id)
                }
              }}>Confirmar Prorrogação</button>
            </div>
          )}
        </Modal>

        <Modal isOpen={reverseModalOpen} onClose={() => setReverseModalOpen(false)} title="Estornar Parcela">
          {activeInstallment && (
            <div className="space-y-4">
              <p>Parcela: {activeInstallment.installmentNumber} - {selectedContract.clients?.name}</p>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo do Estorno *</label>
                <input 
                  type="text" 
                  value={estornoReason}
                  onChange={(e) => setEstornoReason(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                  placeholder="Ex: Pagamento devolvido"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancária (para onde o valor volta) *</label>
                <select 
                  value={estornoAccountId}
                  onChange={(e) => setEstornoAccountId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                >
                  <option value="">Selecione uma conta...</option>
                  {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <button 
                className="w-full bg-rose-600 text-white p-2 rounded-lg disabled:opacity-50" 
                disabled={!estornoReason || !estornoAccountId}
                onClick={async () => {
                  const { error } = await supabase.rpc('process_installment_estorno', { 
                    p_installment_id: activeInstallment.id,
                    p_reason: estornoReason,
                    p_account_id: Number(estornoAccountId),
                    p_user_id: user?.id || null
                  })
                  if (error) {
                    toast.error('Erro ao estornar parcela')
                    console.error(error)
                  } else {
                    toast.success('Parcela estornada com sucesso!')
                    setReverseModalOpen(false)
                    setEstornoReason('')
                    setEstornoAccountId('')
                    fetchInstallmentsForContract(selectedContract.id)
                  }
              }}>Confirmar Estorno</button>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  )
}


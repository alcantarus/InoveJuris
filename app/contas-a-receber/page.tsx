'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { Modal } from '@/components/Modal'
import { KPICard } from '@/components/ui/KPICard'
import { DollarSign, Search, Calendar, CheckCircle2, Clock, AlertCircle, Plus, Receipt, Download, FileText, History, Eye, EyeOff, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useAuth } from '@/lib/auth'
import { supabase, processContractCancellation } from '@/lib/supabase'
import { formatCurrency, formatDate, getStatusColor, getRowColor, cn, getTodayBR, isContractQuitado, normalizeSearchText } from '@/lib/utils'
import { filterEffectiveReceipts } from '@/lib/payments'
import { toast } from 'react-hot-toast'
import { CurrencyInput } from '@/components/CurrencyInput'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import { ContractStatementModal } from '@/components/contas-a-receber/ContractStatementModal'
import { ContractNumberBadge } from '@/components/ui/ContractNumberBadge'

const PAYMENT_METHODS = [
  'Dinheiro',
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Transferência',
  'Boleto',
  'Cheque',
  'Outro',
] as const

function SortIcon({ columnKey, sortConfig }: { columnKey: string, sortConfig: { key: string | null, direction: 'asc' | 'desc' } | null }) {
  if (sortConfig?.key !== columnKey) return <span className="ml-1 text-slate-300">↕</span>;
  return sortConfig.direction === 'asc' ? <span className="ml-1 text-indigo-600">↑</span> : <span className="ml-1 text-indigo-600">↓</span>;
}

export default function ContasAReceberPage() {
  const { isVisible, toggleVisibility } = usePrivacy()
  const [contracts, setContracts] = useState<any[]>([])
  const [selectedContract, setSelectedContract] = useState<any>(null)
  const [installments, setInstallments] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [financialCategories, setFinancialCategories] = useState<any[]>([])
  const [receivedThisMonth, setReceivedThisMonth] = useState(0)
  const [forecast30d, setForecast30d] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedInstallments, setSelectedInstallments] = useState<number[]>([])
  const [receiveModalOpen, setReceiveModalOpen] = useState(false)
  const [prorogueModalOpen, setProrogueModalOpen] = useState(false)
  const [reverseModalOpen, setReverseModalOpen] = useState(false)
  const [collapseMode, setCollapseMode] = useState(false)
  const [collapseCount, setCollapseCount] = useState(0)
  const [statementModalOpen, setStatementModalOpen] = useState(false)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [estornoReason, setEstornoReason] = useState('')
  const [estornoAccountId, setEstornoAccountId] = useState('')
  const [activeInstallment, setActiveInstallment] = useState<any>(null)
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [receiveAmount, setReceiveAmount] = useState(0)
  const [paymentAccount, setPaymentAccount] = useState('')
  const [paymentCategory, setPaymentCategory] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentDescription, setPaymentDescription] = useState('')
  const [batchPaymentModalOpen, setBatchPaymentModalOpen] = useState(false)
  const [batchAccount, setBatchAccount] = useState('')
  const [batchCategory, setBatchCategory] = useState('')
  const [batchMethod, setBatchMethod] = useState('')
  const [batchQueue, setBatchQueue] = useState<number[]>([])
  const [batchStep, setBatchStep] = useState(0)
  const [batchAmount, setBatchAmount] = useState(0)
  const [batchDescription, setBatchDescription] = useState('')
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [batchSuccessCount, setBatchSuccessCount] = useState(0)
  const [batchErrorCount, setBatchErrorCount] = useState(0)
  const batchProcessingRef = React.useRef(false)
  const receiveProcessingRef = React.useRef(false)
  const [prorogueDate, setProrogueDate] = useState('')
  const [adjustDate, setAdjustDate] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
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

  const todayBR = getTodayBR()

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

      await processContractCancellation(
        Number(selectedContract?.id),
        reason,
        user.id
      );

      toast.success('Contrato cancelado com sucesso!');
      setSelectedContract(null);
      fetchContracts();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cancelar contrato');
      console.error('Full error:', error);
    } finally {
      setLoading(false);
    }
  };

  const batchSaldo = (installment: any) =>
    Number(installment?.amount || 0) - Number(installment?.amountPaid || 0)

  const openBatchWizard = () => {
    const eligible = selectedInstallments
      .map(id => installments.find(i => i.id === id))
      .filter((i): i is any => Boolean(i) && isBatchEligible(i.status))

    if (eligible.length === 0) {
      toast.error('Selecione ao menos uma parcela com saldo em aberto.')
      return
    }

    setBatchQueue(eligible.map(i => i.id))
    setBatchStep(0)
    setBatchSuccessCount(0)
    setBatchErrorCount(0)
    setBatchProcessing(false)
    setBatchAmount(batchSaldo(eligible[0]))
    setBatchDescription('')
    setBatchAccount(paymentAccount || '')
    setBatchCategory(paymentCategory || '')
    setBatchMethod(paymentMethod || '')
    setBatchPaymentModalOpen(true)
  }

  const closeBatchWizard = (force = false) => {
    if (batchProcessing && !force) return

    if (!force && batchSuccessCount > 0) {
      const confirmClose = window.confirm(
        `${batchSuccessCount} parcela(s) já foram recebidas. Fechar o restante?`
      )
      if (!confirmClose) return
    }

    setBatchPaymentModalOpen(false)
    setBatchQueue([])
    setBatchStep(0)
    setBatchSuccessCount(0)
    setBatchErrorCount(0)
    setSelectedInstallments([])

    if (selectedContract?.id) fetchInstallmentsForContract(selectedContract.id)
    fetchContracts()
    fetchDashboardMetrics()
  }

  const handleBatchConfirm = async () => {
    if (!user || batchProcessingRef.current) return

    const current = installments.find(i => i.id === batchQueue[batchStep])
    if (!current) return

    if (!batchAccount || !batchCategory || !batchMethod) {
      toast.error('Selecione a conta, a categoria e a forma de pagamento.')
      return
    }

    const saldo = batchSaldo(current)
    const valor = Number(batchAmount || 0)

    if (valor <= 0) {
      toast.error('Informe um valor maior que zero.')
      return
    }
    if (valor > saldo + 0.01) {
      toast.error('O valor não pode ser maior que o saldo da parcela.')
      return
    }

    batchProcessingRef.current = true
    setBatchProcessing(true)
    try {
      const { error } = await supabase.rpc('rpc_receber_parcela_com_metodo', {
        p_installment_id: current.id,
        p_amount_paid: valor,
        p_date: getTodayBR(),
        p_description:
          batchDescription ||
          `Recebimento em lote - parcela ${getInstallmentLabel(current)}`,
        p_account_id: batchAccount,
        p_category_id: batchCategory,
        p_payment_method: batchMethod,
        p_user_id: user.id,
        p_interest: 0,
        p_fine: 0,
      })

      if (error) throw error

      const nextSuccess = batchSuccessCount + 1
      setBatchSuccessCount(nextSuccess)
      // Guarda a última escolha para pré-preencher as próximas parcelas.
      setPaymentAccount(batchAccount)
      setPaymentCategory(batchCategory)
      setPaymentMethod(batchMethod)

      if (batchStep + 1 >= batchQueue.length) {
        toast.success(`${nextSuccess} parcela(s) recebida(s) com sucesso!`)
        closeBatchWizard(true)
      } else {
        const next = installments.find(i => i.id === batchQueue[batchStep + 1])
        setBatchStep(step => step + 1)
        setBatchAmount(batchSaldo(next))
        setBatchDescription('')
      }
    } catch (err: any) {
      console.error(`Erro ao receber parcela ${current.id}:`, err)
      setBatchErrorCount(count => count + 1)
      toast.error(err?.message || 'Erro ao receber esta parcela.')
    } finally {
      batchProcessingRef.current = false
      setBatchProcessing(false)
    }
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
    setProrogueDate(inst.dueDate ? String(inst.dueDate).split('T')[0] : '')
    setProrogueModalOpen(true)
  }

  const openAdjustModal = (inst: any) => {
    setActiveInstallment(inst)
    setAdjustDate(inst.dueDate ? String(inst.dueDate).split('T')[0] : '')
    setAdjustReason(inst.due_date_reason || '')
    setAdjustNotes('')
    setAdjustModalOpen(true)
  }

  const openReverseModal = (inst: any) => {
    // Parcela com filha não pode ser estornada isolada: o saldo ficaria órfão.
    if (getChildren(inst).length > 0 && !canCollapse(inst)) {
      toast.error('Estorne a partir da última subparcela')
      return
    }
    setActiveInstallment(inst)
    setReverseModalOpen(true)
  }

  const openCollapseModal = (inst: any) => {
    setActiveInstallment(inst)
    setCollapseCount(getActiveDescendants(inst).length)
    setCollapseMode(true)
    setReverseModalOpen(true)
  }

  const toggleSelection = (id: number) => {
    setSelectedInstallments(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // Somente parcelas com saldo em aberto entram no recebimento em lote.
  // Estornado continua elegível: o estorno desfaz o recebimento e devolve o
  // título à condição de devedor (decisão de 26/11/2026).
  const isBatchEligible = (status?: string) =>
    !['quitado', 'cancelada', 'cancelado']
      .includes((status || '').toLowerCase())

  // Regras compartilhadas entre a tabela (desktop) e os cards (mobile).
  const getContractRowStatus = (c: any) => {
    let rowStatus = c.contract_status || 'Normal'
    if (rowStatus === 'Aberto') rowStatus = 'Normal'

    if (rowStatus !== 'Cancelado' && rowStatus !== 'Estornado' && rowStatus !== 'Prorrogado') {
      if (c.contracts?.isProBono) rowStatus = 'Pro Bono'
      else if (rowStatus === 'Quitado') rowStatus = 'Quitado'
      else if (c.contracts?.isFinanced) rowStatus = 'Financiado'
      else rowStatus = 'Normal'
    }
    return rowStatus
  }

  const filteredContracts = React.useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm)
    return sortedContracts.filter(c => {
      const matchesSearch = !normalizedSearch ||
        normalizeSearchText(c.processNumber).includes(normalizedSearch) ||
        normalizeSearchText(c.client_name).includes(normalizedSearch)
      if (!matchesSearch) return false
      if (filterType === 'Abertos') return c.contract_status !== 'Quitado' && c.contract_status !== 'Cancelado'
      if (filterType === 'Quitados') return c.contract_status === 'Quitado'
      if (filterType === 'Atrasados') return Number(c.overdue_amount || 0) > 0 && c.contract_status !== 'Quitado' && c.contract_status !== 'Cancelado'
      if (filterType === 'Vence Hoje') return c.next_due_date && c.next_due_date === todayBR && c.contract_status !== 'Quitado' && c.contract_status !== 'Cancelado'
      return true
    })
  }, [sortedContracts, searchTerm, filterType, todayBR])

  const getInstallmentFlags = (i: any) => {
    const status = String(i.status || '').toLowerCase()
    // Estornado voltou a ser devedor: pode contar como atrasado.
    // Prorrogada continua fora de "vencido" (decisão de 26/11/2026).
    const naoAtrasam = ['quitado', 'cancelada', 'cancelado', 'prorrogada', 'prorrogado']
    const isLate = i.dueDate < todayBR && !naoAtrasam.includes(status)
    const daysLate = isLate ? Math.floor((new Date(todayBR).getTime() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0
    return { isLate, daysLate }
  }

  // Quantidade original de parcelas do contrato. A subparcela residual nasce
  // com numeração acima desse total (ex.: 5 originais + residual nº 6).
  const contractInstallmentsCount = Number(
    selectedContract?.contracts?.installmentsCount ??
    selectedContract?.installmentsCount ??
    0
  )

  // --- Árvore de parcelas: 1 -> 1.1 -> 1.1.1 --------------------------------
  // Linhas novas trazem parent_installment_id + installment_path. O legado
  // continua classificado pelo número antigo (sem backfill).
  const getInstallmentLabel = (i: any) => {
    const path = String(i?.installment_path || '').trim()
    return path || String(i?.installmentNumber ?? i?.id ?? '')
  }

  const comparePaths = (a: string, b: string) => {
    const sa = a.split('.').map(Number)
    const sb = b.split('.').map(Number)
    for (let k = 0; k < Math.min(sa.length, sb.length); k++) {
      if (sa[k] !== sb[k]) return sa[k] - sb[k]
    }
    return sa.length - sb.length
  }

  const getTreeRootNumber = (i: any) => {
    const path = String(i?.installment_path || '').trim()
    if (path) return Number(path.split('.')[0]) || 0
    return Number(i?.installmentNumber || 0)
  }

  const getChildren = (i: any) =>
    installments.filter(
      (x: any) =>
        x.parent_installment_id != null &&
        Number(x.parent_installment_id) === Number(i?.id)
    )

  // Descendentes ativos: ignoramos Reabsorvida/Cancelada, que não fazem mais
  // parte da dívida nem da árvore exibida.
  const getActiveDescendants = (i: any) => {
    const found: any[] = []
    const walk = (parentId: any) => {
      for (const x of installments) {
        if (x.parent_installment_id == null) continue
        if (Number(x.parent_installment_id) !== Number(parentId)) continue
        const s = String(x.status || '').toLowerCase()
        if (s === 'reabsorvida' || s === 'cancelada' || s === 'cancelado') continue
        found.push(x)
        walk(x.id)
      }
    }
    walk(i?.id)
    return found
  }

  // Regra B: a mãe só pode ser estornada se todas as folhas ativas da subárvore
  // estiverem Estornado e nenhum descendente tiver valor pago.
  const canCollapse = (i: any) => {
    if (Number(i?.amountPaid || 0) <= 0) return false
    const descendants = getActiveDescendants(i)
    if (descendants.length === 0) return false
    if (descendants.some((x: any) => Number(x.amountPaid || 0) > 0)) return false
    return descendants.every((x: any) => {
      const hasActiveChild = descendants.some(
        (y: any) =>
          y.parent_installment_id != null &&
          Number(y.parent_installment_id) === Number(x.id)
      )
      if (hasActiveChild) return true
      return String(x.status || '').toLowerCase() === 'estornado'
    })
  }

  const getParentLabel = (i: any) => {
    const parentId = i?.parent_installment_id
    if (parentId != null) {
      const parent = installments.find(
        (x: any) => Number(x.id) === Number(parentId)
      )
      if (parent) return getInstallmentLabel(parent)
    }
    const path = String(i?.installment_path || '').trim()
    return path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : null
  }

  // Classifica a linha para a tela:
  // - desdobrada: tem filha (saldo já transferido) ou, no legado, foi fechada
  //   com pagamento parcial;
  // - residual: é filha e é folha;
  // - ativa: raiz sem filha e ainda em aberto.
  const getInstallmentRole = (i: any) => {
    const numero = Number(i.installmentNumber || 0)
    const valor = Number(i.amount || 0)
    const pago = Number(i.amountPaid || 0)
    const status = String(i.status || '').toLowerCase()
    const path = String(i.installment_path || '').trim()

    const children = getChildren(i)
    const hasChildren = children.length > 0
    const isChild = i.parent_installment_id != null || path.includes('.')
    const depth = path ? Math.max(0, path.split('.').length - 1) : 0

    let isResidual = isChild && !hasChildren

    // Fallback legado: sem vínculo/path, usa a numeração acima do total
    // original. Quando o contrato não informa o total, compara o vencimento.
    if (!path && i.parent_installment_id == null) {
      isResidual = contractInstallmentsCount > 0 && numero > contractInstallmentsCount

      if (contractInstallmentsCount === 0) {
        const mesmas = installments.filter(
          (x: any) =>
            String(x.dueDate || '').slice(0, 10) ===
            String(i.dueDate || '').slice(0, 10)
        )
        const origem = mesmas.reduce((menor: any, x: any) => {
          const n = Number(x.installmentNumber || 0)
          return !menor || n < Number(menor.installmentNumber || 0) ? x : menor
        }, null)
        if (origem && mesmas.length > 1) {
          const numeroOrigem = Number(origem.installmentNumber || 0)
          const valorOrigem = Number(origem.amount || 0)
          isResidual = numero > numeroOrigem && valor < valorOrigem - 0.01
        }
      }
    }

    const isDesdobrada =
      hasChildren ||
      (!isResidual && status === 'quitado' && pago > 0 && pago < valor - 0.01)

    const isAtiva =
      !isResidual &&
      !isDesdobrada &&
      !['quitado', 'cancelada', 'cancelado'].includes(status)

    const orderedChildren = [...children].sort((a: any, b: any) => {
      const pa = String(a.installment_path || '').trim()
      const pb = String(b.installment_path || '').trim()
      if (pa || pb) {
        if (!pa) return -1
        if (!pb) return 1
        return comparePaths(pa, pb)
      }
      return Number(a.installmentNumber || 0) - Number(b.installmentNumber || 0)
    })
    const firstChild = orderedChildren[0]

    return {
      isResidual,
      isDesdobrada,
      isAtiva,
      isChild,
      hasChildren,
      depth,
      parentLabel: getParentLabel(i),
      childLabel: firstChild ? getInstallmentLabel(firstChild) : null,
      canCollapse: canCollapse(i),
    }
  }

  const cancelBlocked = Boolean(selectedContract) && (
    selectedContract.status === 'Cancelado' ||
    isContractQuitado(selectedContract.status, selectedContract.contractValue, selectedContract.amountReceived) ||
    installments.some((i: any) => Number(i.amountPaid || 0) > 0)
  )

  const receivableKpis = React.useMemo(() => {
    const active = contracts.filter(c => c.contract_status !== 'Cancelado' && c.contract_status !== 'Quitado')
    const receivedSelected = installments.reduce((acc, i) => acc + Number(i.amountPaid || 0), 0)
    return {
      totalToReceive: active.reduce((acc, c) => acc + Number(c.amount_to_receive || 0), 0),
      totalOverdue: active
        .reduce((acc, c) => acc + Number(c.overdue_amount || 0), 0),
      totalReceived: !selectedContract
        ? contracts.reduce((acc, c) => acc + Number(c.amount_received || 0), 0)
        : receivedSelected,
      // Com contrato selecionado, usar o saldo gravado no contrato evita
      // duplicar a dívida em cadeias legadas sem vínculo (parcela estornada
      // reaberta + residual quitada). Fallback para ambientes sem o campo.
      totalOpen: !selectedContract
        ? active.reduce((acc, c) => acc + Number(c.amount_to_receive || 0), 0)
        : selectedContract.amountReceivable != null
          ? Number(selectedContract.amountReceivable)
          : Math.max(0, Number(selectedContract.contractValue || 0) - receivedSelected),
    }
  }, [contracts, installments, selectedContract, todayBR])

  const openContract = (c: any) => setSelectedContract({
    id: c.contract_id,
    processNumber: c.processNumber,
    clients: { name: c.client_name },
    status: c.contract_status,
    contractValue: c.contract_value,
    amountReceived: c.amount_received,
    amountReceivable: c.amount_to_receive,
    // Necessário para identificar a subparcela residual (numeração acima do
    // total original de parcelas).
    installmentsCount: c.contracts?.installmentsCount ?? c.installmentsCount ?? null
  })

  const fetchLookups = React.useCallback(async () => {
    const [accountsRes, categoriesRes] = await Promise.all([
      supabase.from('bank_accounts').select('id, name'),
      supabase.from('financial_categories').select('id, name').eq('type', 'income')
    ])
    if (accountsRes.data) setBankAccounts(accountsRes.data)
    if (categoriesRes.data) setFinancialCategories(categoriesRes.data)
  }, [])

  const fetchDashboardMetrics = React.useCallback(async () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

    // Recebido este mês
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('id, amount, payment_date, description, type, installment_id, reverses_payment_id')
      .gte('payment_date', firstDayOfMonth)
      .lte('payment_date', todayStr);
    
    // Recebimento estornado não compõe o caixa: descarta a reversão e o
    // pagamento original que ela desfez. O filtro por descrição permanece
    // como proteção para estornos antigos gravados como 'payment'.
    const filteredPayments = filterEffectiveReceipts(paymentsData || [])
      .filter((p: any) => !p.description || !p.description.toLowerCase().includes('estorno'));

    const totalReceived = filteredPayments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
    setReceivedThisMonth(totalReceived);

    // Previsão 30 dias
    // Estornado entra: o estorno devolve o título ao devedor. Cancelada e
    // Quitado ficam de fora; o fluxo de cancelamento já marca as parcelas do
    // contrato como Cancelada.
    const { data: installmentsData } = await supabase
      .from('installments')
      .select('amount, amountPaid')
      .gte('dueDate', todayStr)
      .lte('dueDate', thirtyDaysStr)
      .in('status', ['Aberto', 'Parcial', 'Atrasada', 'Prorrogada', 'Estornado']);

    const totalForecast = installmentsData?.reduce((acc: number, i: any) => acc + (Number(i.amount || 0) - Number(i.amountPaid || 0)), 0) || 0;
    setForecast30d(totalForecast);
  }, []);

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

    let contractsData: any[] | null = null
    let contractsError: any = null

    ;({ data: contractsData, error: contractsError } = await supabase
      .from('contracts')
      .select('id, isProBono, isFinanced, contractNumber, installmentsCount'))

    // Fallback: alguns ambientes podem não ter contractNumber ou ter nome diferente
    if (contractsError) {
      const retry = await supabase
        .from('contracts')
        .select('id, isProBono, isFinanced')
      contractsData = retry.data
      contractsError = retry.error
      if (contractsError) {
        console.warn('Não foi possível carregar detalhes extras dos contratos:', contractsError?.message || contractsError)
      }
    }

    const mergedData = (summaryData || []).map((s: any) => ({
      ...s,
      contracts: contractsData?.find((c: any) => c.id === s.contract_id)
    }))
    setContracts(mergedData)
    setLoading(false)
  }, [])

  const fetchInstallmentsForContract = React.useCallback(async (contractId: number) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('installments')
      .select(`*`)
      .eq('contract_id', contractId)
      .order('installmentNumber', { ascending: true })

    if (error) {
      toast.error('Erro ao buscar parcelas')
      console.error(error)
    } else {
      // Ordem da árvore: raiz por número, filhas logo após a mãe
      // (1, 1.1, 1.1.1, 2, 2.1, 3). Linhas sem path caem na ordem antiga por
      // vencimento, dentro da mesma raiz — compatível com o legado.
      const ordered = [...(data || [])].sort((a: any, b: any) => {
        const rootA = getTreeRootNumber(a)
        const rootB = getTreeRootNumber(b)
        if (rootA !== rootB) return rootA - rootB

        const pathA = String(a.installment_path || '').trim()
        const pathB = String(b.installment_path || '').trim()
        if (pathA || pathB) {
          if (!pathA) return -1
          if (!pathB) return 1
          const byPath = comparePaths(pathA, pathB)
          if (byPath !== 0) return byPath
        }

        const dueA = String(a.dueDate || '').slice(0, 10)
        const dueB = String(b.dueDate || '').slice(0, 10)
        if (dueA !== dueB) return dueA.localeCompare(dueB)
        return Number(a.installmentNumber || 0) - Number(b.installmentNumber || 0)
      })
      // Reabsorvida não participa mais da dívida nem da árvore exibida.
      const visible = ordered.filter(
        (a: any) => String(a.status || '').toLowerCase() !== 'reabsorvida'
      )
      setInstallments(visible)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchContracts()
    fetchLookups()
    fetchDashboardMetrics()
  }, [fetchContracts, fetchLookups, fetchDashboardMetrics])

  useEffect(() => {
    if (selectedContract) {
      if (selectedContract?.id) fetchInstallmentsForContract(selectedContract.id)
    }
  }, [selectedContract, fetchInstallmentsForContract])

  const batchCurrentInstallment =
    batchQueue.length > 0
      ? installments.find(i => i.id === batchQueue[batchStep])
      : null

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
            value={formatCurrency(receivableKpis.totalToReceive, isVisible('receivable_total'))} 
            icon={DollarSign} 
            color="indigo" 
            isVisible={isVisible('receivable_total')}
            onToggleVisibility={() => toggleVisibility('receivable_total')}
          />
          <KPICard 
            title="Total em Atraso" 
            value={formatCurrency(receivableKpis.totalOverdue, isVisible('receivable_overdue'))} 
            icon={AlertCircle} 
            color="rose" 
            isVisible={isVisible('receivable_overdue')}
            onToggleVisibility={() => toggleVisibility('receivable_overdue')}
          />
          <KPICard 
            title="Recebido este Mês" 
            value={formatCurrency(receivedThisMonth, isVisible('receivable_monthly'))} 
            icon={CheckCircle2} 
            color="emerald" 
            isVisible={isVisible('receivable_monthly')}
            onToggleVisibility={() => toggleVisibility('receivable_monthly')}
          />
          <KPICard 
            title="Previsão (30d)" 
            value={formatCurrency(forecast30d, isVisible('receivable_forecast'))} 
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
                {formatCurrency(receivableKpis.totalReceived, isVisible('receivable_summary_received'))}
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
                {formatCurrency(receivableKpis.totalOpen, isVisible('receivable_summary_to_receive'))}
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[800px]">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs">
                <tr>
                  <th className="p-4 cursor-pointer" onClick={() => handleSort('client_name')}>Cliente / Processo <SortIcon sortConfig={sortConfig} columnKey="client_name" /></th>
                  <th className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer" onClick={() => handleSort('contract_value')}>
                      Valor Contrato <SortIcon sortConfig={sortConfig} columnKey="contract_value" />
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
                      Recebido <SortIcon sortConfig={sortConfig} columnKey="amount_received" />
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
                      A Receber <SortIcon sortConfig={sortConfig} columnKey="amount_to_receive" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleVisibility('receivable_table_to_receive'); }} 
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors ml-1"
                        title={isVisible('receivable_table_to_receive') ? "Ocultar valor" : "Mostrar valor"}
                      >
                        {isVisible('receivable_table_to_receive') ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                    </div>
                  </th>
                  <th className="p-4 cursor-pointer" onClick={() => handleSort('next_due_date')}>Próx. Vencimento <SortIcon sortConfig={sortConfig} columnKey="next_due_date" /></th>
                  <th className="p-4 cursor-pointer" onClick={() => handleSort('contract_status')}>Situação <SortIcon sortConfig={sortConfig} columnKey="contract_status" /></th>
                  <th className="p-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="p-4 text-center">Carregando...</td></tr>
                ) : filteredContracts.map((c, index) => {
                  const rowStatus = getContractRowStatus(c)

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
                      <ContractNumberBadge
                        contractNumber={c.contracts?.contractNumber}
                        processNumber={c.processNumber}
                        contractId={c.contract_id}
                        className="mt-1"
                      />
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
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold", 
                        getStatusColor(rowStatus), 
                        c.contract_status?.toLowerCase() === 'cancelado' && "line-through opacity-60"
                      )}>
                        {rowStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <button 
                        className={cn(
                          "font-medium text-xs uppercase tracking-wider",
                          (rowStatus === 'Cancelado' || rowStatus === 'Pro Bono')
                            ? "text-slate-400 cursor-not-allowed" 
                            : "text-indigo-600 hover:text-indigo-800"
                        )} 
                        onClick={() => openContract(c)}
                        disabled={rowStatus === 'Cancelado' || rowStatus === 'Pro Bono'}
                      >
                        Ver Parcelas
                      </button>
                    </td>
                  </motion.tr>
                )})}
              </tbody>
            </table>
            </div>

            {/* Cards mobile: mesma disposição de Clientes/Contratos, sem rolagem horizontal */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading ? (
                <div className="p-4 text-center text-sm text-slate-500">Carregando...</div>
              ) : filteredContracts.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">Nenhum contrato encontrado.</div>
              ) : filteredContracts.map((c, index) => {
                const rowStatus = getContractRowStatus(c)
                const actionDisabled = rowStatus === 'Cancelado' || rowStatus === 'Pro Bono'

                return (
                  <motion.div
                    key={c.contract_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn("p-4 space-y-3", getRowColor(rowStatus))}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 break-words flex flex-wrap items-center gap-1.5">
                          {c.client_name}
                          {c.contracts?.isProBono && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">Pro Bono</span>
                          )}
                          {c.contracts?.isFinanced && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-100 text-cyan-800 border border-cyan-200">Financiado</span>
                          )}
                        </div>
                        <ContractNumberBadge
                          contractNumber={c.contracts?.contractNumber}
                          processNumber={c.processNumber}
                          contractId={c.contract_id}
                          className="mt-0.5"
                        />
                      </div>
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold shrink-0",
                        getStatusColor(rowStatus),
                        c.contract_status?.toLowerCase() === 'cancelado' && "line-through opacity-60"
                      )}>
                        {rowStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          Valor Contrato
                          <button onClick={() => toggleVisibility('receivable_table_value')} className="text-slate-400 hover:text-indigo-600" title={isVisible('receivable_table_value') ? "Ocultar valor" : "Mostrar valor"}>
                            {isVisible('receivable_table_value') ? <Eye size={11} /> : <EyeOff size={11} />}
                          </button>
                        </div>
                        <div className="text-slate-900 break-words">{formatCurrency(c.contract_value, isVisible('receivable_table_value'))}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          Recebido
                          <button onClick={() => toggleVisibility('receivable_table_received')} className="text-slate-400 hover:text-indigo-600" title={isVisible('receivable_table_received') ? "Ocultar valor" : "Mostrar valor"}>
                            {isVisible('receivable_table_received') ? <Eye size={11} /> : <EyeOff size={11} />}
                          </button>
                        </div>
                        <div className="font-bold text-emerald-600 break-words">{formatCurrency(c.amount_received, isVisible('receivable_table_received'))}</div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${Math.min((c.amount_received / (c.contract_value || 1)) * 100, 100)}%` }}></div>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          A Receber
                          <button onClick={() => toggleVisibility('receivable_table_to_receive')} className="text-slate-400 hover:text-indigo-600" title={isVisible('receivable_table_to_receive') ? "Ocultar valor" : "Mostrar valor"}>
                            {isVisible('receivable_table_to_receive') ? <Eye size={11} /> : <EyeOff size={11} />}
                          </button>
                        </div>
                        <div className="text-slate-600 break-words">{formatCurrency(c.amount_to_receive, isVisible('receivable_table_to_receive'))}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Próx. Vencimento</div>
                        <div className="text-slate-600 break-words">{c.next_due_date ? formatDate(c.next_due_date) : '-'}</div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        className={cn(
                          "min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider",
                          actionDisabled ? "bg-slate-100 text-slate-400" : "bg-indigo-50 text-indigo-700"
                        )}
                        onClick={() => openContract(c)}
                        disabled={actionDisabled}
                      >
                        Ver Parcelas
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <button className="text-slate-500 hover:text-slate-700 flex items-center gap-1" onClick={() => setSelectedContract(null)}>&larr; Voltar para Contratos</button>
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <ContractNumberBadge
                  contractNumber={selectedContract?.contracts?.contractNumber}
                  processNumber={selectedContract?.processNumber}
                  contractId={selectedContract?.id}
                />
                <h2 className="mt-1.5 text-lg font-bold break-all">
                  {selectedContract?.clients?.name || 'Cliente não informado'}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {selectedInstallments.length > 0 && (
                  <button 
                    className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
                    onClick={openBatchWizard}
                  >
                    Receber Selecionados ({selectedInstallments.length})
                  </button>
                )}
                <button 
                  className={cn(
                    "flex-1 md:flex-none px-4 py-2 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
                    cancelBlocked ? "bg-slate-400" : "bg-rose-600 hover:bg-rose-700"
                  )}
                  onClick={cancelContract}
                  disabled={cancelBlocked}
                  title={
                    selectedContract.status === 'Cancelado'
                      ? 'Contrato já cancelado'
                      : cancelBlocked
                        ? 'Cancelamento bloqueado: contrato quitado ou com pagamento registrado'
                        : 'Cancelar contrato'
                  }
                >
                  {selectedContract.status === 'Cancelado' ? 'Contrato Cancelado' : 'Cancelar Contrato'}
                </button>
                <button 
                  className="flex-1 md:flex-none px-4 py-2 bg-slate-600 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition"
                  onClick={() => setStatementModalOpen(true)}
                >
                  Ver Extrato de Recebimentos
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[800px]">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs">
                  <tr>
                    <th className="p-4 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                        checked={installments.some(i => isBatchEligible(i.status)) && selectedInstallments.length === installments.filter(i => isBatchEligible(i.status)).length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInstallments(installments.filter(i => isBatchEligible(i.status)).map(i => i.id))
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
                    const { isLate, daysLate } = getInstallmentFlags(i)
                    const { isResidual, isDesdobrada, isAtiva, hasChildren, depth, parentLabel, childLabel, canCollapse } = getInstallmentRole(i)
                    const label = getInstallmentLabel(i)
                    const estornoBloqueado = hasChildren && !canCollapse
                    const estornoComColapso = hasChildren && canCollapse

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
                          disabled={!isBatchEligible(i.status)}
                          onChange={() => toggleSelection(i.id)} 
                        />
                      </td>
                      <td className="p-4 font-medium text-slate-900">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-lg border px-2 py-1 font-semibold",
                                depth === 0
                                  ? "bg-slate-100 border-slate-200 text-slate-700"
                                  : hasChildren
                                    ? "bg-white border-violet-200 text-violet-700"
                                    : "bg-sky-50 border-sky-200 text-sky-700"
                              )}
                              style={{ marginLeft: depth * 16 }}
                              title={depth > 0 ? `Caminho: ${label}` : undefined}
                            >
                              {depth > 0 && <span className="mr-1 text-slate-300">└</span>}
                              {label}
                            </span>
                            {isDesdobrada && (
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200"
                                title="Parcela com subparcela: o saldo foi transferido para a próxima"
                              >
                                Desdobrada
                              </span>
                            )}
                            {isResidual && (
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700 border border-sky-200"
                                title="Subparcela residual gerada pelo desdobramento de uma parcela parcial"
                              >
                                Residual
                              </span>
                            )}
                            {isAtiva && (
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200"
                                title="Parcela ativa, sem desdobramento"
                              >
                                Ativa
                              </span>
                            )}
                            {isLate && (
                              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", daysLate > 30 ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-700")}>
                                {daysLate} dias atraso
                              </span>
                            )}
                          </div>
                          <span className="mt-1 text-[10px] text-slate-400">
                            {parentLabel
                              ? `saldo da parcela ${parentLabel}`
                              : contractInstallmentsCount > 0
                                ? `parcela original ${i.installmentNumber} de ${contractInstallmentsCount}`
                                : 'parcela original'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">
                        <div className="flex flex-col">
                          <span>{formatDate(i.dueDate)}</span>
                          {i.original_due_date && String(i.original_due_date).split('T')[0] !== String(i.dueDate).split('T')[0] && (
                            <span className="text-[10px] text-amber-700" title={i.due_date_reason ? `Motivo: ${i.due_date_reason}` : 'Data prevista ajustada'}>
                              Original: {formatDate(i.original_due_date)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-900 font-medium">{formatCurrency(i.amount, isVisible('receivable_installment_value'))}</td>
                      <td className="p-4 text-slate-600">{formatCurrency(i.amountPaid || 0, isVisible('receivable_installment_paid'))}</td>
                      <td className="p-4 text-emerald-600 font-bold">
                        {isDesdobrada ? (
                          <span className="text-slate-400 font-normal" title={childLabel ? `Saldo na ${childLabel}` : 'Saldo transferido para a parcela residual'}>
                            —
                            <span className="block text-[9px] font-medium text-slate-400">
                              {childLabel ? `saldo na ${childLabel}` : 'saldo na residual'}
                            </span>
                          </span>
                        ) : (
                          formatCurrency(i.status === 'Quitado' ? 0 : (i.amount - (i.amountPaid || 0)), isVisible('receivable_installment_balance'))
                        )}
                      </td>
                      <td className="p-4">
                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold", getStatusColor(i.status), i.status?.toLowerCase() === 'cancelada' && "line-through")}>
                          {i.status}
                        </span>
                      </td>
                      <td className="p-4 flex flex-wrap gap-3">
                        <button 
                          className={cn("text-emerald-600 hover:text-emerald-800 font-medium text-xs uppercase tracking-wider disabled:text-slate-300", (i.status === 'Quitado' || i.status?.toLowerCase() === 'cancelada') && "pointer-events-none")}
                          disabled={i.status === 'Quitado' || i.status?.toLowerCase() === 'cancelada'}
                          onClick={() => openReceiveModal(i)}
                        >
                          Receber
                        </button>
                        <button 
                          className={cn("text-indigo-600 hover:text-indigo-800 font-medium text-xs uppercase tracking-wider disabled:text-slate-300", (i.status === 'Quitado' || i.status?.toLowerCase() === 'cancelada') && "pointer-events-none")}
                          disabled={i.status === 'Quitado' || i.status?.toLowerCase() === 'cancelada'}
                          onClick={() => openAdjustModal(i)}
                        >
                          Ajustar previsão
                        </button>
                        <button 
                          className={cn("text-amber-600 hover:text-amber-800 font-medium text-xs uppercase tracking-wider disabled:text-slate-300", (i.status === 'Quitado' || i.status?.toLowerCase() === 'cancelada') && "pointer-events-none")}
                          disabled={i.status === 'Quitado' || i.status?.toLowerCase() === 'cancelada'}
                          onClick={() => openProrogueModal(i)}
                        >
                          Prorrogar
                        </button>
                        <button 
                          className={cn("text-rose-600 hover:text-rose-800 font-medium text-xs uppercase tracking-wider disabled:text-slate-300", (((i.status !== 'Quitado' && i.status !== 'Parcial') || Number(i.amountPaid || 0) <= 0) || estornoBloqueado) && "pointer-events-none")}
                          disabled={(i.status !== 'Quitado' && i.status !== 'Parcial') || Number(i.amountPaid || 0) <= 0 || estornoBloqueado}
                          title={estornoBloqueado
                            ? 'Estorne a partir da última subparcela'
                            : estornoComColapso
                              ? 'Estorna esta parcela e reabsorve as subparcelas'
                              : undefined}
                          onClick={() => estornoComColapso ? openCollapseModal(i) : openReverseModal(i)}
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

              {/* Cards mobile das parcelas: sem rolagem horizontal */}
              <div className="md:hidden divide-y divide-slate-100">
                {loading ? (
                  <div className="p-4 text-center text-sm text-slate-500">Carregando...</div>
                ) : installments.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">Nenhuma parcela encontrada.</div>
                ) : installments.map((i, index) => {
                  const { isLate, daysLate } = getInstallmentFlags(i)
                  const { isResidual, isDesdobrada, isAtiva, hasChildren, depth, parentLabel, childLabel, canCollapse } = getInstallmentRole(i)
                  const label = getInstallmentLabel(i)
                  const isCancelled = i.status?.toLowerCase() === 'cancelada'
                  // Quitado bloqueia ações, mas NÃO deve riscar a linha: parcela
                  // quitada é concluída, não cancelada.
                  const isClosed = i.status === 'Quitado' || isCancelled
                  const canReverse = (i.status === 'Quitado' || i.status === 'Parcial') && Number(i.amountPaid || 0) > 0 && (!hasChildren || canCollapse)
                  const contractCancelled = selectedContract.status?.toLowerCase() === 'cancelado'

                  return (
                    <motion.div
                      key={i.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn("p-4 space-y-3", (contractCancelled || isCancelled) && "bg-rose-50 line-through text-slate-400")}
                    >
                      {depth > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                          <span>Parcela</span>
                          {label.split('.').map((_, idx, arr) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && <span>›</span>}
                              <span className={idx === arr.length - 1 ? 'font-semibold text-violet-700' : ''}>
                                {arr.slice(0, idx + 1).join('.')}
                              </span>
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between items-start gap-3">
                        <label className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 h-5 w-5 shrink-0"
                            checked={selectedInstallments.includes(i.id)}
                            disabled={!isBatchEligible(i.status)}
                            onChange={() => toggleSelection(i.id)}
                          />
                          <span className="min-w-0">
                            <span className="font-semibold text-slate-900 flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-lg border px-2 py-1",
                                  depth === 0
                                    ? "bg-slate-100 border-slate-200 text-slate-700"
                                    : hasChildren
                                      ? "bg-white border-violet-200 text-violet-700"
                                      : "bg-sky-50 border-sky-200 text-sky-700"
                                )}
                                style={{ marginLeft: depth * 12 }}
                                title={depth > 0 ? `Caminho: ${label}` : undefined}
                              >
                                {depth > 0 && <span className="mr-1 text-slate-300">└</span>}
                                {label}
                              </span>
                              {isDesdobrada && (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200"
                                  title="Parcela com subparcela: o saldo foi transferido para a próxima"
                                >
                                  Desdobrada
                                </span>
                              )}
                              {isResidual && (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700 border border-sky-200"
                                  title="Subparcela residual gerada pelo desdobramento de uma parcela parcial"
                                >
                                  Residual
                                </span>
                              )}
                              {isAtiva && (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200"
                                  title="Parcela ativa, sem desdobramento"
                                >
                                  Ativa
                                </span>
                              )}
                            </span>
                            <span className="block mt-1 text-[10px] text-slate-400">
                              {parentLabel
                                ? `saldo da parcela ${parentLabel}`
                                : contractInstallmentsCount > 0
                                  ? `parcela original ${i.installmentNumber} de ${contractInstallmentsCount}`
                                  : 'parcela original'}
                            </span>
                          </span>
                        </label>
                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold shrink-0", getStatusColor(i.status), i.status?.toLowerCase() === 'cancelada' && "line-through")}>
                          {i.status}
                        </span>
                      </div>

                      <div className="text-sm text-slate-600">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Vencimento: </span>
                        <span className="break-words">{formatDate(i.dueDate)}</span>
                        {isLate && (
                          <span className={cn("ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase", daysLate > 30 ? "bg-rose-600 text-white" : "bg-rose-100 text-rose-700")}>
                            {daysLate} dias atraso
                          </span>
                        )}
                        {i.original_due_date && String(i.original_due_date).split('T')[0] !== String(i.dueDate).split('T')[0] && (
                          <div className="text-[10px] text-amber-700 mt-1" title={i.due_date_reason ? `Motivo: ${i.due_date_reason}` : 'Data prevista ajustada'}>
                            Original: {formatDate(i.original_due_date)}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                            Valor
                            <button onClick={() => toggleVisibility('receivable_installment_value')} className="text-slate-400 hover:text-indigo-600" title={isVisible('receivable_installment_value') ? "Ocultar valor" : "Mostrar valor"}>
                              {isVisible('receivable_installment_value') ? <Eye size={11} /> : <EyeOff size={11} />}
                            </button>
                          </div>
                          <div className="text-slate-900 break-words">{formatCurrency(i.amount, isVisible('receivable_installment_value'))}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                            Pago
                            <button onClick={() => toggleVisibility('receivable_installment_paid')} className="text-slate-400 hover:text-indigo-600" title={isVisible('receivable_installment_paid') ? "Ocultar valor" : "Mostrar valor"}>
                              {isVisible('receivable_installment_paid') ? <Eye size={11} /> : <EyeOff size={11} />}
                            </button>
                          </div>
                          <div className="text-slate-600 break-words">{formatCurrency(i.amountPaid || 0, isVisible('receivable_installment_paid'))}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                            A Receber
                            <button onClick={() => toggleVisibility('receivable_installment_balance')} className="text-slate-400 hover:text-indigo-600" title={isVisible('receivable_installment_balance') ? "Ocultar valor" : "Mostrar valor"}>
                              {isVisible('receivable_installment_balance') ? <Eye size={11} /> : <EyeOff size={11} />}
                            </button>
                          </div>
                          <div className="font-bold text-emerald-600 break-words">
                            {isDesdobrada ? (
                              <span className="text-slate-400 font-normal" title={childLabel ? `Saldo na ${childLabel}` : 'Saldo transferido para a parcela residual'}>
                                —
                                <span className="block text-[9px] font-medium text-slate-400">
                                  {childLabel ? `saldo na ${childLabel}` : 'saldo na residual'}
                                </span>
                              </span>
                            ) : (
                              formatCurrency(i.status === 'Quitado' ? 0 : (i.amount - (i.amountPaid || 0)), isVisible('receivable_installment_balance'))
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          className={cn("min-h-[40px] px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold", isClosed && "pointer-events-none opacity-40")}
                          disabled={isClosed}
                          onClick={() => openReceiveModal(i)}
                        >Receber</button>
                        <button
                          className={cn("min-h-[40px] px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold", isClosed && "pointer-events-none opacity-40")}
                          disabled={isClosed}
                          onClick={() => openAdjustModal(i)}
                        >Ajustar previsão</button>
                        <button
                          className={cn("min-h-[40px] px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold", isClosed && "pointer-events-none opacity-40")}
                          disabled={isClosed}
                          onClick={() => openProrogueModal(i)}
                        >Prorrogar</button>
                        <button
                          className={cn("min-h-[40px] px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold", !canReverse && "pointer-events-none opacity-40")}
                          disabled={!canReverse}
                          title={hasChildren && !canCollapse
                            ? 'Estorne a partir da última subparcela'
                            : hasChildren && canCollapse
                              ? 'Estorna esta parcela e reabsorve as subparcelas'
                              : undefined}
                          onClick={() => hasChildren && canCollapse ? openCollapseModal(i) : openReverseModal(i)}
                        >Estornar</button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
        
        <Modal isOpen={receiveModalOpen} onClose={() => setReceiveModalOpen(false)} title="Receber Parcela">
          {activeInstallment && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">Parcela: {getInstallmentLabel(activeInstallment)}</p>
                <p className="font-bold text-lg">{selectedContract?.clients?.name}</p>
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
                        <span>
                          {formatDate(p.payment_date)}
                          {p.payment_method ? ` · ${p.payment_method}` : ''} - {p.description || 'Pagamento'}
                        </span>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Pagamento</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20">
                    <option value="">Selecione a forma</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
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
                <button
                  className="w-full bg-emerald-600 text-white p-3 rounded-lg font-bold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!paymentAccount || !paymentCategory || !paymentMethod}
                  onClick={async () => {
                    if (receiveProcessingRef.current) return
                    if (!paymentAccount || !paymentCategory || !paymentMethod) {
                      toast.error('Selecione a conta, a categoria e a forma de pagamento.')
                      return
                    }

                    const valor = Number(receiveAmount)
                    const saldo = Number(activeInstallment.amount || 0) - Number(activeInstallment.amountPaid || 0)

                    if (valor <= 0) {
                      toast.error('Informe um valor maior que zero.')
                      return
                    }
                    if (valor > saldo + 0.01) {
                      toast.error('O valor não pode ser maior que o saldo da parcela.')
                      return
                    }

                    const isPartial = valor < saldo - 0.01

                    receiveProcessingRef.current = true
                    try {
                      const { error } = await supabase.rpc('rpc_receber_parcela_com_metodo', {
                        p_installment_id: activeInstallment.id,
                        p_amount_paid: valor,
                        p_date: getTodayBR(),
                        p_description: paymentDescription,
                        p_account_id: paymentAccount,
                        p_category_id: paymentCategory,
                        p_payment_method: paymentMethod,
                        p_user_id: user?.id,
                        p_interest: 0,
                        p_fine: 0
                      })

                      if (error) {
                        toast.error(error.message || 'Erro ao processar pagamento')
                        console.error(error)
                      } else {
                        toast.success(isPartial ? 'Pagamento parcial processado com desdobramento!' : 'Pagamento processado com sucesso!')
                        setReceiveModalOpen(false)
                        if (selectedContract?.id) {
                          fetchInstallmentsForContract(selectedContract.id)
                          fetchContracts()
                          fetchDashboardMetrics()
                        }
                      }
                    } finally {
                      receiveProcessingRef.current = false
                    }
                  }}
                >Confirmar Recebimento</button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={batchPaymentModalOpen}
          onClose={() => closeBatchWizard()}
          title={
            batchQueue.length > 0
              ? `Recebimento em Lote · ${batchStep + 1} de ${batchQueue.length}`
              : 'Recebimento em Lote'
          }
        >
          {batchCurrentInstallment ? (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">
                  Parcela: {getInstallmentLabel(batchCurrentInstallment)}
                  {batchCurrentInstallment.dueDate
                    ? ` · vence ${formatDate(batchCurrentInstallment.dueDate)}`
                    : ''}
                </p>
                <p className="font-bold text-lg">{selectedContract?.clients?.name}</p>
                <div className="flex justify-between mt-2 text-sm">
                  <span>
                    Valor Original:{' '}
                    {formatCurrency(
                      batchCurrentInstallment.amount,
                      isVisible('receivable_installment_value')
                    )}
                  </span>
                  <span className="font-bold text-emerald-600">
                    Saldo:{' '}
                    {formatCurrency(
                      batchSaldo(batchCurrentInstallment),
                      isVisible('receivable_installment_balance')
                    )}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                <p className="text-xs text-emerald-900">
                  Cada parcela é recebida individualmente. Informe a conta e a forma de
                  pagamento desta parcela; as próximas serão pré-preenchidas com a mesma
                  escolha, mas podem ser alteradas.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Valor a Receber
                  </label>
                  <CurrencyInput
                    value={batchAmount}
                    onChange={setBatchAmount}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Conta</label>
                  <select
                    value={batchAccount}
                    onChange={(e) => setBatchAccount(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Selecione uma conta</option>
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={batchMethod}
                    onChange={(e) => setBatchMethod(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Selecione a forma</option>
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                  <select
                    value={batchCategory}
                    onChange={(e) => setBatchCategory(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Selecione uma categoria</option>
                    {financialCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Descrição (opcional)
                  </label>
                  <input
                    type="text"
                    value={batchDescription}
                    onChange={(e) => setBatchDescription(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {batchStep + 1} de {batchQueue.length} parcela(s)
                </span>
                <span className="font-bold text-slate-900">
                  Esta parcela:{' '}
                  {formatCurrency(
                    Number(batchAmount || 0),
                    isVisible('receivable_installment_value')
                  )}
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition disabled:opacity-50"
                  onClick={() => closeBatchWizard()}
                  disabled={batchProcessing}
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={
                    batchProcessing || !batchAccount || !batchCategory || !batchMethod
                  }
                  onClick={handleBatchConfirm}
                >
                  {batchProcessing
                    ? 'Processando...'
                    : batchStep + 1 >= batchQueue.length
                      ? 'Confirmar recebimento'
                      : 'Confirmar e próxima'}
                  {!batchProcessing && batchStep + 1 < batchQueue.length && (
                    <ChevronRight size={16} />
                  )}
                </button>
              </div>

              {batchErrorCount > 0 && (
                <p className="text-xs text-rose-600">
                  {batchErrorCount} tentativa(s) falharam nesta sessão. A parcela atual
                  permanece aberta para correção.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nenhuma parcela selecionada.</p>
          )}
        </Modal>

        <Modal isOpen={prorogueModalOpen} onClose={() => setProrogueModalOpen(false)} title="Prorrogar Parcela">
          {activeInstallment && (
            <div className="space-y-4">
              <p>Parcela: {getInstallmentLabel(activeInstallment)} - {selectedContract?.clients?.name}</p>
              {activeInstallment.original_due_date && String(activeInstallment.original_due_date).split('T')[0] !== String(activeInstallment.dueDate || '').split('T')[0] && (
                <p className="text-xs text-slate-500">Data original: {formatDate(activeInstallment.original_due_date)}</p>
              )}
              <label className="block text-sm font-medium text-slate-700">Nova Data de Vencimento</label>
              <input type="date" value={prorogueDate} onChange={(e) => setProrogueDate(e.target.value)} className="w-full p-2 border rounded-lg" />
              <button className="w-full bg-amber-600 text-white p-2 rounded-lg disabled:opacity-50" disabled={!prorogueDate} onClick={async () => {
                const basePayload: any = {
                  dueDate: prorogueDate,
                  status: 'Prorrogada',
                }
                if (!activeInstallment.original_due_date) {
                  basePayload.original_due_date = activeInstallment.dueDate
                }
                const fullPayload: any = {
                  ...basePayload,
                  due_date_adjusted_at: new Date().toISOString(),
                  due_date_adjusted_by: user?.id ?? null,
                  due_date_reason: 'Prorrogação de vencimento'
                }
                let { error } = await supabase
                  .from('installments')
                  .update(fullPayload)
                  .eq('id', activeInstallment.id)
                if (error) {
                  // Fallback se colunas de auditoria do ajuste ainda não existirem no banco
                  ({ error } = await supabase
                    .from('installments')
                    .update(basePayload)
                    .eq('id', activeInstallment.id))
                }
                if (error) {
                  toast.error(error?.message || 'Erro ao prorrogar parcela')
                  console.error('Erro ao prorrogar parcela:', error)
                } else {
                  toast.success('Parcela prorrogada com sucesso!')
                  setProrogueModalOpen(false)
                  if (selectedContract?.id) fetchInstallmentsForContract(selectedContract.id)
                  fetchContracts()
                  fetchDashboardMetrics()
                }
              }}>Confirmar Prorrogação</button>
            </div>
          )}
        </Modal>

        <Modal isOpen={adjustModalOpen} onClose={() => setAdjustModalOpen(false)} title="Ajustar previsão de recebimento">
          {activeInstallment && (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">Parcela: <span className="font-medium">{getInstallmentLabel(activeInstallment)}</span> - {selectedContract?.clients?.name}</p>
              <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-1">
                <p><span className="text-slate-500">Data prevista atual:</span> {formatDate(activeInstallment.dueDate)}</p>
                {activeInstallment.original_due_date && (
                  <p><span className="text-slate-500">Data original:</span> {formatDate(activeInstallment.original_due_date)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nova data prevista de recebimento *</label>
                <input type="date" value={adjustDate} onChange={(e) => setAdjustDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo do ajuste *</label>
                <select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg">
                  <option value="">Selecione...</option>
                  <option value="Decisão judicial sem data precisa">Decisão judicial sem data precisa</option>
                  <option value="Aguardando deferimento/agenda do INSS">Aguardando deferimento/agenda do INSS</option>
                  <option value="Data precisa informada em decisão/despacho">Data precisa informada em decisão/despacho</option>
                  <option value="Acordo homologado">Acordo homologado</option>
                  <option value="Previsão administrativa/financeira">Previsão administrativa/financeira</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observação (opcional)</label>
                <textarea value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} rows={3} className="w-full p-2 border border-slate-300 rounded-lg" placeholder="Detalhes do ajuste, nº do despacho, informação do INSS etc." />
              </div>

              <div className="flex gap-2">
                {activeInstallment.original_due_date && String(activeInstallment.original_due_date).split('T')[0] !== String(activeInstallment.dueDate || '').split('T')[0] && (
                  <button
                    type="button"
                    className="flex-1 bg-slate-100 text-slate-700 p-2 rounded-lg hover:bg-slate-200 transition"
                    onClick={async () => {
                      const basePayload: any = {
                        dueDate: String(activeInstallment.original_due_date).split('T')[0],
                      }
                      const fullPayload: any = {
                        ...basePayload,
                        due_date_adjusted_at: new Date().toISOString(),
                        due_date_adjusted_by: user?.id ?? null,
                        due_date_reason: 'Restaurada data original'
                      }
                      let { error } = await supabase
                        .from('installments')
                        .update(fullPayload)
                        .eq('id', activeInstallment.id)
                      if (error) {
                        ({ error } = await supabase
                          .from('installments')
                          .update(basePayload)
                          .eq('id', activeInstallment.id))
                      }
                      if (error) {
                        toast.error(error?.message || 'Erro ao restaurar data original')
                        console.error('Erro ao restaurar data original:', error)
                      } else {
                        toast.success('Data original restaurada')
                        setAdjustModalOpen(false)
                        if (selectedContract?.id) fetchInstallmentsForContract(selectedContract.id)
                        fetchContracts()
                        fetchDashboardMetrics()
                      }
                    }}
                  >
                    Restaurar original
                  </button>
                )}
                <button
                  className="flex-1 bg-indigo-600 text-white p-2 rounded-lg disabled:opacity-50"
                  disabled={!adjustDate || !adjustReason}
                  onClick={async () => {
                    const reason = adjustNotes.trim() ? `${adjustReason} - ${adjustNotes.trim()}` : adjustReason
                    const basePayload: any = {
                      dueDate: adjustDate,
                    }
                    if (!activeInstallment.original_due_date) {
                      basePayload.original_due_date = activeInstallment.dueDate
                    }
                    const fullPayload: any = {
                      ...basePayload,
                      due_date_adjusted_at: new Date().toISOString(),
                      due_date_adjusted_by: user?.id ?? null,
                      due_date_reason: reason
                    }
                    let { error } = await supabase
                      .from('installments')
                      .update(fullPayload)
                      .eq('id', activeInstallment.id)
                    if (error) {
                      // Fallback se colunas de auditoria do ajuste ainda não existirem no banco
                      ({ error } = await supabase
                        .from('installments')
                        .update(basePayload)
                        .eq('id', activeInstallment.id))
                    }
                    if (error) {
                      toast.error(error?.message || 'Erro ao ajustar previsão')
                      console.error('Erro ao ajustar previsão:', error)
                    } else {
                      toast.success('Previsão de recebimento atualizada')
                      setAdjustModalOpen(false)
                      if (selectedContract?.id) fetchInstallmentsForContract(selectedContract.id)
                      fetchContracts()
                      fetchDashboardMetrics()
                    }
                  }}
                >
                  Salvar previsão
                </button>
              </div>
            </div>
          )}
        </Modal>

        <Modal isOpen={reverseModalOpen} onClose={() => { setReverseModalOpen(false); setCollapseMode(false) }} title="Estornar Parcela">
          {activeInstallment && (
            <div className="space-y-4">
              <p>Parcela: {getInstallmentLabel(activeInstallment)} - {selectedContract?.clients?.name}</p>

              {collapseMode && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  Esta ação estorna a parcela e <b>reabsorve {collapseCount} subparcela(s)</b>. As linhas
                  serão marcadas como <b>Reabsorvida</b>, desvinculadas da árvore e ocultas da tela.
                </div>
              )}
              
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
                  const { error } = await supabase.rpc(
                    collapseMode ? 'process_installment_estorno_colapso' : 'process_installment_estorno',
                    {
                      p_installment_id: activeInstallment.id,
                      p_reason: estornoReason,
                      p_account_id: Number(estornoAccountId),
                      p_user_id: user?.id || null
                    }
                  )
                  if (error) {
                    toast.error(error.message || 'Erro ao estornar parcela')
                    console.error(error)
                  } else {
                    toast.success(collapseMode ? 'Parcela estornada e subparcelas reabsorvidas!' : 'Parcela estornada com sucesso!')
                    setReverseModalOpen(false)
                    setCollapseMode(false)
                    setCollapseCount(0)
                    setEstornoReason('')
                    setEstornoAccountId('')
                    if (selectedContract?.id) fetchInstallmentsForContract(selectedContract.id)
                    fetchContracts()
                    fetchDashboardMetrics()
                  }
              }}>Confirmar Estorno</button>
            </div>
          )}
        </Modal>

        <ContractStatementModal 
          isOpen={statementModalOpen} 
          onClose={() => setStatementModalOpen(false)} 
          contractId={selectedContract?.id}
          contractTitle={`${selectedContract?.processNumber || 'Sem Processo'} - ${selectedContract?.clients?.name || 'Sem Cliente'}`}
          contractNumber={selectedContract?.contracts?.contractNumber}
          processNumber={selectedContract?.processNumber}
        />
      </div>
    </DashboardLayout>
  )
}




'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'motion/react'
import { ModuleHeader } from '@/components/ModuleHeader'
import { Modal } from '@/components/Modal'
import { CurrencyInput } from '@/components/CurrencyInput'
import { 
  BarChart3, 
  Calendar, 
  ArrowUpCircle, 
  ArrowDownCircle,
  AlertCircle,
  Baby,
  Clock,
  Scale,
  Gift,
  Coins,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Receipt,
  Eye,
  EyeOff
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import DashboardLayout from '../dashboard-layout'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import { toast } from 'sonner'

interface ChildbirthReportItem {
  id: number
  clientName: string
  document: string
  phone: string
  childbirthDate: string
  rn_birth_date: string | null
  daysRemaining: number
  isProBono: boolean
  isFinanced: boolean
  status: string
}

interface DeadlineReportItem {
  id: number
  processNumber: string
  clientName: string
  deadlineDate: string
  daysRemaining: number
  description?: string
}

interface BirthdayReportItem {
  id: number
  clientName: string
  document: string
  phone: string
  birthDate: string
  nextBirthday: string
  daysRemaining: number
  age: number
  type: 'cliente' | 'indicador'
}

interface CommissionReportItem {
  id: number
  clientName: string
  productName: string
  indicatorName: string
  contractValue: number
  base_comissao: number
  commissionPercent: number
  commissionValue: number
  status: string
  contractDate: string
}

// Uma coluna serve tanto para a tabela (desktop) quanto para o card (mobile),
// evitando duplicar a regra de negócio de cada relatório.
interface ReportColumn {
  key: string
  label: string
  cellClassName: string
  value: React.ReactNode
}

const ReportCardField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0">
    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
    <div className="text-sm text-slate-600 break-words min-w-0 mt-0.5">{value}</div>
  </div>
)

interface RecebimentoItem {
  id: number
  date: string
  clientName: string
  description: string
  accountName: string
  categoryName: string
  amount: number
}

type ReportType = 'childbirth' | 'deadlines' | 'birthdays' | 'commissions' | 'gps' | 'recebimentos' | 'a-receber'

// Componente de Badge para o status do INSS
const StatusBadge = ({ protocolNumber }: { protocolNumber: string | null | undefined }) => {
  const isProtocolled = protocolNumber && protocolNumber.trim() !== ''
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
      isProtocolled 
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
        : "bg-rose-50 text-rose-700 border border-rose-200"
    )}>
      {isProtocolled ? (
        <>
          <CheckCircle2 size={12} />
          <span>Sim: {protocolNumber}</span>
        </>
      ) : (
        <>
          <XCircle size={12} />
          <span>Não</span>
        </>
      )}
    </div>
  )
}

// Componente de Barra de Progresso para o status do processo
const ProcessProgressBar = ({ generated, paid }: { generated: boolean, paid: boolean }) => {
  const progress = paid ? 100 : generated ? 50 : 0
  
  return (
    <div className="w-24">
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full transition-all duration-500",
            paid ? "bg-emerald-500" : generated ? "bg-amber-500" : "bg-slate-300"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-500 mt-1 block text-center">
        {paid ? 'Concluído' : generated ? 'Gerada' : 'Pendente'}
      </span>
    </div>
  )
}

function RelatoriosPageContent() {
  const { isVisible, toggleVisibility } = usePrivacy()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  const [activeReport, setActiveReport] = useState<ReportType>('deadlines')

  useEffect(() => {
    if (tab === 'gps') {
      setActiveReport('gps')
    } else if (tab === 'childbirth') {
      setActiveReport('childbirth')
    } else if (tab === 'birthdays') {
      setActiveReport('birthdays')
    } else if (tab === 'commissions') {
      setActiveReport('commissions')
    } else if (tab === 'deadlines') {
      setActiveReport('deadlines')
    }
  }, [tab])
  const [childbirthData, setChildbirthData] = useState<ChildbirthReportItem[]>([])
  const [childbirthFilter, setChildbirthFilter] = useState<'all' | 'probono' | 'financed'>('all')
  const [deadlineData, setDeadlineData] = useState<DeadlineReportItem[]>([])
  const [birthdayData, setBirthdayData] = useState<BirthdayReportItem[]>([])
  const [commissionData, setCommissionData] = useState<CommissionReportItem[]>([])
  const [gpsData, setGpsData] = useState<any[]>([]) // Adicionado estado para GPS
  const [gpsFilter, setGpsFilter] = useState<'all' | 'paid' | 'unpaid' | 'financed' | 'normal' | 'divergence'>('all')
  const [recebimentosData, setRecebimentosData] = useState<RecebimentoItem[]>([])
  const [rawRecebimentosData, setRawRecebimentosData] = useState<any[]>([])
  const [recebimentosStartDate, setRecebimentosStartDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  })
  const [recebimentosEndDate, setRecebimentosEndDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  })
  const [recebimentosAccountFilter, setRecebimentosAccountFilter] = useState('all')
  const [recebimentosTagFilter, setRecebimentosTagFilter] = useState('')
  const [aReceberData, setAReceberData] = useState<any[]>([])
  const [aReceberTagFilter, setAReceberTagFilter] = useState('')
  const [aReceberShowAllPeriods, setAReceberShowAllPeriods] = useState(true)
  const [aReceberSearch, setAReceberSearch] = useState('')
  const [aReceberStartDate, setAReceberStartDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  })
  const [aReceberEndDate, setAReceberEndDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear() + 1, now.getMonth(), 0).toISOString().split('T')[0]
  })
  const [aReceberStatusFilter, setAReceberStatusFilter] = useState<'all' | 'pending' | 'overdue'>('all')
  const [accountsList, setAccountsList] = useState<any[]>([])
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedGps, setSelectedGps] = useState<any>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(true)

  // Filter raw data when filter or raw data changes
  useEffect(() => {
    if (rawRecebimentosData.length > 0) {
      const processed: RecebimentoItem[] = rawRecebimentosData
        .filter((item: any) => {
          const passesType = item.type !== 'reversal' || Number(item.amount) > 0;
          if (!recebimentosTagFilter) return passesType;
          const tags = item.installments?.contracts?.clients?.tags || [];
          return passesType && tags.some((t: string) => t.toLowerCase().includes(recebimentosTagFilter.toLowerCase()));
        })
        .map((item: any) => {
          const clientName = item.installments?.contracts?.clients?.name || 'Cliente Avulso / Não informado'
          const installmentNum = item.installments?.installmentNumber
          const processNum = item.installments?.contracts?.processNumber
          
          let defaultDesc = 'Recebimento de Parcela'
          if (installmentNum && processNum) {
            defaultDesc = `Parcela ${installmentNum} - Processo ${processNum}`
          } else if (installmentNum) {
            defaultDesc = `Parcela ${installmentNum}`
          }

          return {
            id: item.id,
            date: item.payment_date,
            clientName: clientName,
            description: item.description || defaultDesc,
            accountName: item.bank_accounts?.name || 'Conta não informada',
            categoryName: item.financial_categories?.name || 'Receitas de Contratos',
            amount: Number(item.amount || 0)
          }
        })

      processed.sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })
      setRecebimentosData(processed)
    } else {
      setRecebimentosData([])
    }
  }, [rawRecebimentosData, recebimentosTagFilter, sortOrder])

  useEffect(() => {
    if (tab === 'gps') {
      setActiveReport('gps')
    } else if (tab === 'childbirth') {
      setActiveReport('childbirth')
    } else if (tab === 'birthdays') {
      setActiveReport('birthdays')
    } else if (tab === 'commissions') {
      setActiveReport('commissions')
    } else if (tab === 'deadlines') {
      setActiveReport('deadlines')
    } else if (tab === 'recebimentos') {
      setActiveReport('recebimentos')
    }
  }, [tab])

  useEffect(() => {
    if (activeReport === 'childbirth') {
      fetchChildbirthData()
    } else if (activeReport === 'deadlines') {
      fetchDeadlineData()
    } else if (activeReport === 'birthdays') {
      fetchBirthdayData()
    } else if (activeReport === 'commissions') {
      fetchCommissionData()
    } else if (activeReport === 'gps') {
      fetchGpsData()
    } else if (activeReport === 'recebimentos') {
      fetchRecebimentosData()
    } else if (activeReport === 'a-receber') {
      fetchAReceberData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, recebimentosStartDate, recebimentosEndDate, recebimentosAccountFilter, aReceberStartDate, aReceberEndDate, aReceberShowAllPeriods])

  const fetchRecebimentosData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      if (accountsList.length === 0) {
        const { data: accs } = await supabase.from('bank_accounts').select('id, name')
        if (accs) setAccountsList(accs)
      }

      let query = supabase
        .from('payments')
        .select(`
          id,
          payment_date,
          amount,
          type,
          description,
          account_id,
          category_id,
          bank_accounts(id, name),
          financial_categories(id, name),
          installments(
            id,
            installmentNumber,
            contracts(
              id,
              processNumber,
              clients(
                id,
                name,
                tags
              )
            )
          )
        `)
        .gte('payment_date', recebimentosStartDate)
        .lte('payment_date', recebimentosEndDate)

      if (recebimentosAccountFilter !== 'all') {
        query = query.eq('account_id', Number(recebimentosAccountFilter))
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching payments in relatorios:', error)
        throw error
      }

      setRawRecebimentosData(data || [])
    } catch (error) {
      console.error('Error fetching recebimentos:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAReceberData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      let query = supabase
        .from('installments')
        .select(`
          id,
          amount,
          amountPaid,
          dueDate,
          status,
          installmentNumber,
          contract_id,
          contracts(
            processNumber,
            status,
            clients(name, tags)
          )
        `)
        .neq('status', 'Quitado')
        .neq('status', 'Cancelada')
        .neq('contracts.status', 'Cancelado')

      if (!aReceberShowAllPeriods) {
        if (aReceberStartDate) {
          query = query.gte('dueDate', aReceberStartDate)
        }
        if (aReceberEndDate) {
          query = query.lte('dueDate', aReceberEndDate)
        }
      }

      const { data, error } = await query
        .order('dueDate', { ascending: true })

      if (error) throw error

      // Filtragem robusta: 
      // 1. Remove contratos cancelados.
      // 2. Remove parcelas sem contrato ou sem cliente vinculado (evita "Cliente Avulso").
      const filteredData = (data || []).filter((item: any) => 
        item.contracts && 
        item.contracts.status !== 'Cancelado' && 
        item.contracts.clients?.name
      )

      setAReceberData(filteredData || [])
    } catch (error) {
      console.error('Error fetching A Receber data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleQuitarAReceberItem = async (item: any) => {
    try {
      const remaining = Number(item.amount || 0) - Number(item.amountPaid || 0);
      if (remaining <= 0) {
        toast.warning('Esta parcela já está quitada.');
        return;
      }
      const { error } = await supabase.rpc('process_installment_payment', {
        p_installment_id: item.id,
        p_amount_paid: remaining,
        p_account_id: null,
        p_category_id: null,
        p_date: new Date().toISOString().split('T')[0],
        p_description: `Quitação via Relatório A Receber`,
        p_user_id: null,
        p_interest: 0,
        p_fine: 0
      });
      if (error) throw error;
      toast.success('Parcela quitada com sucesso!');
      fetchAReceberData();
    } catch (err: any) {
      console.error('Erro ao quitar parcela:', err);
      toast.error('Erro ao quitar parcela: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const getFilteredAReceberData = () => {
    const filtered = aReceberData.filter(item => {
      // 0. Search filter
      if (aReceberSearch) {
        const queryText = aReceberSearch.toLowerCase();
        const clientName = (item.contracts?.clients?.name || '').toLowerCase();
        const processNum = (item.contracts?.processNumber || '').toLowerCase();
        if (!clientName.includes(queryText) && !processNum.includes(queryText)) {
          return false;
        }
      }

      // 1. Tag filter
      if (aReceberTagFilter) {
        const tags = item.contracts?.clients?.tags || [];
        const hasTag = tags.some((t: string) => t.toLowerCase().includes(aReceberTagFilter.toLowerCase()));
        if (!hasTag) return false;
      }

      // 2. Status Filter
      if (aReceberStatusFilter === 'pending') {
        const isOverdue = new Date(item.dueDate) < new Date();
        if (isOverdue) return false;
      } else if (aReceberStatusFilter === 'overdue') {
        const isOverdue = new Date(item.dueDate) < new Date();
        if (!isOverdue) return false;
      }

      return true;
    });

    // 3. Sort by dueDate
    return filtered.sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  };

  // Filtro compartilhado pela tabela desktop e pelos cards mobile.
  const getReportRows = (): any[] => {
    if (activeReport === 'deadlines') return deadlineData
    if (activeReport === 'childbirth') {
      return childbirthData.filter(item => {
        if (childbirthFilter === 'all') return true;
        if (childbirthFilter === 'probono') return item.isProBono;
        if (childbirthFilter === 'financed') return item.isFinanced;
        return true;
      })
    }
    if (activeReport === 'birthdays') return birthdayData
    if (activeReport === 'gps') {
      return gpsData.filter(item => {
        if (gpsFilter === 'all') return true;
        if (gpsFilter === 'paid') return item.gpsPaid;
        if (gpsFilter === 'unpaid') return !item.gpsPaid;
        if (gpsFilter === 'financed') return item.isFinanced;
        if (gpsFilter === 'normal') return !item.isFinanced;
        if (gpsFilter === 'divergence') return item.gps_value !== (item.gps_paid_value || 0);
        return true;
      })
    }
    if (activeReport === 'recebimentos') return recebimentosData
    if (activeReport === 'a-receber') return getFilteredAReceberData()
    return commissionData
  }

  // Colunas compartilhadas: a mesma célula alimenta o <td> e o card mobile.
  const getReportColumns = (item: any): ReportColumn[] => {
    if (activeReport === 'recebimentos') {
      return [
        { key: 'date', label: 'Data do Recebimento', cellClassName: 'font-medium text-slate-900', value: formatDate(item.date) },
        { key: 'client', label: 'Cliente / Parte', cellClassName: 'font-semibold text-slate-900', value: item.clientName },
        { key: 'description', label: 'Descrição / Título', cellClassName: 'text-slate-600', value: item.description },
        {
          key: 'account',
          label: 'Conta Creditada',
          cellClassName: 'text-slate-600 font-medium',
          value: <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-slate-100 text-slate-700">{item.accountName}</span>
        },
        {
          key: 'category',
          label: 'Categoria',
          cellClassName: 'text-slate-600',
          value: <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-indigo-50 text-indigo-700">{item.categoryName}</span>
        },
        {
          key: 'amount',
          label: 'Valor Recebido',
          cellClassName: 'text-right font-bold text-emerald-600',
          value: formatCurrency(item.amount, isVisible('reports_recebimentos'))
        }
      ]
    }

    if (activeReport === 'a-receber') {
      const isOverdue = new Date(item.dueDate) < new Date()
      return [
        { key: 'dueDate', label: 'Data Venc.', cellClassName: 'font-medium text-slate-900', value: formatDate(item.dueDate) },
        { key: 'client', label: 'Cliente / Contrato', cellClassName: 'font-semibold text-slate-900', value: item.contracts?.clients?.name || 'Cliente Avulso' },
        { key: 'process', label: 'Processo', cellClassName: 'text-slate-600', value: item.contracts?.processNumber || '-' },
        {
          key: 'tags',
          label: 'TAGs',
          cellClassName: '',
          value: (
            <div className="flex gap-1 flex-wrap">
              {(item.contracts?.clients?.tags || []).map((tag: string) => (
                <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px]">{tag}</span>
              ))}
            </div>
          )
        },
        {
          key: 'amount',
          label: 'Valor',
          cellClassName: 'text-right font-bold text-slate-900',
          value: formatCurrency(Number(item.amount || 0) - Number(item.amountPaid || 0))
        },
        {
          key: 'status',
          label: 'Status',
          cellClassName: '',
          value: (
            <span className={cn(
              "px-2 py-1 rounded-full text-[10px] font-medium",
              isOverdue ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
            )}>
              {isOverdue ? 'Atrasado' : 'Pendente'}
            </span>
          )
        },
        {
          key: 'actions',
          label: 'Ações',
          cellClassName: 'text-right',
          value: (
            <button
              onClick={() => handleQuitarAReceberItem(item)}
              className="px-3 py-1 min-h-[40px] md:min-h-0 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              title="Quitar saldo restante"
            >
              Quitar
            </button>
          )
        }
      ]
    }

    if (activeReport === 'deadlines') {
      return [
        { key: 'process', label: 'Processo', cellClassName: 'font-medium text-slate-900', value: item.processNumber },
        { key: 'client', label: 'Cliente', cellClassName: 'text-slate-600', value: item.clientName },
        { key: 'description', label: 'Descrição', cellClassName: 'text-slate-600', value: item.description || '-' },
        { key: 'deadlineDate', label: 'Data do Prazo', cellClassName: 'text-slate-900 font-medium', value: formatDate(item.deadlineDate) },
        {
          key: 'daysRemaining',
          label: 'Dias Restantes',
          cellClassName: 'text-right',
          value: (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
              item.daysRemaining < 0
                ? 'bg-slate-100 text-slate-600'
                : item.daysRemaining <= 5
                  ? 'bg-rose-100 text-rose-700'
                  : item.daysRemaining <= 15
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
            }`}>
              {item.daysRemaining < 0
                ? `Venceu há ${Math.abs(item.daysRemaining)} dias`
                : item.daysRemaining === 0
                  ? 'Vence hoje!'
                  : `Faltam ${item.daysRemaining} dias`}
            </span>
          )
        }
      ]
    }

    if (activeReport === 'childbirth') {
      const canceledClass = item.status === 'Cancelado' ? 'line-through text-slate-400 opacity-60' : ''
      const badgeCanceledClass = item.status === 'Cancelado' ? 'line-through opacity-60' : ''
      return [
        { key: 'client', label: 'Cliente', cellClassName: cn('p-4 font-medium text-slate-900', canceledClass), value: item.clientName },
        {
          key: 'modality',
          label: 'Modalidade',
          cellClassName: '',
          value: item.isProBono ? (
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700", badgeCanceledClass)}>Pro Bono</span>
          ) : item.isFinanced ? (
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700", badgeCanceledClass)}>Financiado</span>
          ) : (
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600", badgeCanceledClass)}>Normal</span>
          )
        },
        { key: 'document', label: 'CPF', cellClassName: cn('p-4 text-slate-600', canceledClass), value: item.document },
        { key: 'phone', label: 'WhatsApp', cellClassName: cn('p-4 text-slate-600', canceledClass), value: item.phone },
        { key: 'forecast', label: 'Previsão Parto', cellClassName: cn('p-4 text-slate-900 font-medium', canceledClass), value: formatDate(item.childbirthDate) },
        { key: 'birthDate', label: 'Data Parto', cellClassName: cn('p-4 text-slate-900 font-medium', canceledClass), value: item.rn_birth_date ? formatDate(item.rn_birth_date) : '-' },
        {
          key: 'daysRemaining',
          label: 'Dias Faltantes',
          cellClassName: 'text-right',
          value: (
            <span className={cn(`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold`,
              item.status === 'Cancelado'
                ? 'bg-[#ea9999]/10 text-slate-400 line-through'
                : item.daysRemaining < 0
                  ? 'bg-slate-100 text-slate-600'
                  : item.daysRemaining <= 30
                    ? 'bg-rose-100 text-rose-700'
                    : item.daysRemaining <= 90
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
            )}>
              {item.status === 'Cancelado'
                ? 'CANCELADO'
                : item.daysRemaining < 0
                  ? `Ocorreu há ${Math.abs(item.daysRemaining)} dias`
                  : item.daysRemaining === 0
                    ? 'É hoje!'
                    : `Faltam ${item.daysRemaining} dias`}
            </span>
          )
        }
      ]
    }

    if (activeReport === 'birthdays') {
      return [
        {
          key: 'client',
          label: 'Cliente',
          cellClassName: 'font-medium text-slate-900',
          value: (
            <div className="flex items-center gap-2 break-words">
              <span className="min-w-0 break-words">{item.clientName}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0",
                item.type === 'cliente' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
              )}>
                {item.type}
              </span>
            </div>
          )
        },
        { key: 'document', label: 'CPF', cellClassName: 'text-slate-600', value: item.document },
        { key: 'phone', label: 'WhatsApp', cellClassName: 'text-slate-600', value: item.phone },
        { key: 'birthDate', label: 'Data de Nasc.', cellClassName: 'text-slate-900 font-medium', value: formatDate(item.birthDate) },
        { key: 'age', label: 'Idade', cellClassName: 'text-right text-slate-600 font-medium', value: `${item.age} anos` },
        {
          key: 'daysRemaining',
          label: 'Dias Faltantes',
          cellClassName: 'text-right',
          value: (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
              item.daysRemaining === 0
                ? 'bg-emerald-100 text-emerald-700'
                : item.daysRemaining <= 7
                  ? 'bg-rose-100 text-rose-700'
                  : item.daysRemaining <= 30
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-700'
            }`}>
              {item.daysRemaining === 0 ? 'É hoje! 🎉' : `Faltam ${item.daysRemaining} dias`}
            </span>
          )
        }
      ]
    }

    if (activeReport === 'gps') {
      const isCanceled = item.status?.toLowerCase().trim() === 'cancelado'
      return [
        {
          key: 'client',
          label: 'Cliente',
          cellClassName: '',
          value: (
            <div className="min-w-0">
              <div className="font-medium text-slate-900 break-words">{item.clientName}</div>
              {item.isFinanced ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 mt-1">Financiado</span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 mt-1">Normal</span>
              )}
            </div>
          )
        },
        { key: 'birthDate', label: 'Data Parto', cellClassName: 'text-slate-600 font-medium', value: formatDate(item.childbirthDate) },
        { key: 'protocol', label: 'Req. INSS', cellClassName: '', value: <StatusBadge protocolNumber={item.protocolNumber} /> },
        {
          key: 'status',
          label: 'Status',
          cellClassName: '',
          value: (
            <span className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
              isCanceled ? "bg-rose-100 text-rose-700" : item.gpsPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            )}>
              {isCanceled ? 'Cancelado' : (item.gpsPaid ? 'Pago' : 'Pendente')}
            </span>
          )
        },
        {
          key: 'forecast',
          label: 'Previsão',
          cellClassName: '',
          value: <div className="flex items-center gap-2 font-medium text-slate-900 break-words">{formatDate(item.gps_forecast_date)}</div>
        },
        {
          key: 'payment',
          label: 'Pagto',
          cellClassName: '',
          value: isCanceled ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">Cancelado</span>
          ) : item.gpsPaid ? (
            <span className="text-slate-600 font-medium">{formatDate(item.gps_payment_date)}</span>
          ) : (
            <button
              onClick={() => {
                setSelectedGps(item)
                setIsPaymentModalOpen(true)
              }}
              className="inline-flex items-center px-3 py-1.5 min-h-[40px] md:min-h-0 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors"
            >
              Registrar
            </button>
          )
        },
        {
          key: 'expectedValue',
          label: 'Valor Previsto',
          cellClassName: 'text-right font-medium text-slate-900',
          value: formatCurrency(item.gps_value, isVisible('reports_gps'))
        },
        {
          key: 'paidValue',
          label: 'Valor Pago',
          cellClassName: 'text-right font-medium text-emerald-600',
          value: formatCurrency(item.gps_paid_value, isVisible('reports_gps'))
        },
        {
          key: 'difference',
          label: 'Diferença',
          cellClassName: 'text-right font-bold text-slate-900',
          value: formatCurrency(item.gps_value - (item.gps_paid_value || 0), isVisible('reports_gps'))
        }
      ]
    }

    return [
      { key: 'indicator', label: 'Indicador', cellClassName: 'font-bold text-slate-900', value: item.indicatorName },

      {
        key: 'clientProduct',
        label: 'Cliente / Produto',
        cellClassName: '',
        value: (
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 break-words">{item.clientName}</div>
            <div className="text-xs text-slate-500 break-words">{item.productName}</div>
          </div>
        )
      },
      { key: 'contractValue', label: 'Valor Contrato', cellClassName: 'text-slate-600', value: formatCurrency(item.contractValue, isVisible('reports_commissions')) },
      { key: 'base', label: 'Base Comissão', cellClassName: 'text-slate-600', value: formatCurrency(item.base_comissao, isVisible('reports_commissions')) },
      { key: 'percent', label: '%', cellClassName: 'text-slate-600 font-medium', value: `${item.commissionPercent}%` },
      { key: 'commission', label: 'Comissão', cellClassName: 'text-indigo-600 font-bold', value: formatCurrency(item.commissionValue, isVisible('reports_commissions')) },
      {
        key: 'status',
        label: 'Status',
        cellClassName: 'text-right',
        value: (
          <span className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
            item.status === 'Quitado' ? "bg-emerald-100 text-emerald-700" :
            item.status === 'Cancelado' ? "bg-rose-100 text-rose-700" :
            "bg-amber-100 text-amber-700"
          )}>
            {item.status}
          </span>
        )
      }
    ]
  }

  const reportRows = getReportRows()

  // Re-sort when sortOrder changes
  useEffect(() => {
    if (activeReport === 'childbirth' && childbirthData.length > 0) {
      const sorted = [...childbirthData].sort((a, b) => {
        const dateA = new Date(a.childbirthDate).getTime()
        const dateB = new Date(b.childbirthDate).getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })
      setChildbirthData(sorted)
    } else if (activeReport === 'deadlines' && deadlineData.length > 0) {
      const sorted = [...deadlineData].sort((a, b) => {
        const dateA = new Date(a.deadlineDate).getTime()
        const dateB = new Date(b.deadlineDate).getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })
      setDeadlineData(sorted)
    } else if (activeReport === 'birthdays' && birthdayData.length > 0) {
      const sorted = [...birthdayData].sort((a, b) => {
        const dateA = new Date(a.nextBirthday).getTime()
        const dateB = new Date(b.nextBirthday).getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })
      setBirthdayData(sorted)
    } else if (activeReport === 'commissions' && commissionData.length > 0) {
      const sorted = [...commissionData].sort((a, b) => {
        const dateA = new Date(a.contractDate).getTime()
        const dateB = new Date(b.contractDate).getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })
      setCommissionData(sorted)
    } else if (activeReport === 'gps' && gpsData.length > 0) {
      const sorted = [...gpsData].sort((a, b) => {
        const dateA = new Date(a.gps_forecast_date || '9999-12-31').getTime()
        const dateB = new Date(b.gps_forecast_date || '9999-12-31').getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })
      setGpsData(sorted)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOrder])

  const fetchGpsData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('contracts')
        .select('*, clients(name)')
        .not('gps_forecast_date', 'is', null)

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Supabase data (GPS):', data)

      if (data) {
        // Removemos a filtragem que excluía cancelados, pois você deseja que eles apareçam por último.
        
        const processedData = data.map((item: any) => ({
          id: item.id,
          clientName: item.clients?.name || 'Cliente não encontrado',
          childbirthDate: item.childbirthDate,
          gps_forecast_date: item.gps_forecast_date,
          gpsGenerated: item.gpsGenerated || false,
          gpsPaid: item.gpsPaid || false,
          gps_payment_date: item.gps_payment_date,
          gps_value: item.gps_value || 0,
          gps_paid_value: item.gps_paid_value || 0,
          inss_protocol_number: item.inssProtocol,
          isFinanced: item.isFinanced || false,
          status: item.status
        }))

        // Ordenação robusta (Case-Insensitive)
        processedData.sort((a: any, b: any) => {
          const getPriority = (item: any) => {
            const status = item.status?.toUpperCase();
            if (status === 'CANCELADO') return 3;
            if (item.gpsPaid === true) return 2;
            return 1; // PENDENTE
          };

          const priorityA = getPriority(a);
          const priorityB = getPriority(b);

          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          
          const dateA = new Date(a.gps_forecast_date || '9999-12-31').getTime();
          const dateB = new Date(b.gps_forecast_date || '9999-12-31').getTime();
          
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        })

        setGpsData(processedData)
      }
    } catch (error) {
      console.error('Error fetching GPS data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBirthdayData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const [clientsRes, indicatorsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, document, phone, birthDate')
          .not('birthDate', 'is', null),
        supabase
          .from('indicators')
          .select('id, name, cpf, phone, data_nascimento')
          .not('data_nascimento', 'is', null)
      ])

      if (clientsRes.error) throw clientsRes.error
      if (indicatorsRes.error) throw indicatorsRes.error

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const currentYear = today.getFullYear()

      const processData = (data: any[], type: 'cliente' | 'indicador'): BirthdayReportItem[] => {
        return data.map((item: any) => {
          const birthDate = type === 'cliente' ? item.birthDate : item.data_nascimento
          const bDate = new Date(birthDate)
          const bDateLocal = new Date(bDate.getTime() + bDate.getTimezoneOffset() * 60000)
          
          let nextBday = new Date(currentYear, bDateLocal.getMonth(), bDateLocal.getDate())
          if (nextBday.getTime() < today.getTime()) {
            nextBday.setFullYear(currentYear + 1)
          }
          
          const diffTime = nextBday.getTime() - today.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          const age = nextBday.getFullYear() - bDateLocal.getFullYear()

          return {
            id: item.id,
            clientName: item.name || 'Sem nome',
            document: (type === 'cliente' ? item.document : item.cpf) || 'N/A',
            phone: item.phone || 'N/A',
            birthDate: birthDate,
            nextBirthday: nextBday.toISOString(),
            daysRemaining: diffDays,
            age: age,
            type: type
          }
        })
      }

      const clientsData = processData(clientsRes.data || [], 'cliente')
      const indicatorsData = processData(indicatorsRes.data || [], 'indicador')
      
      const processedData = [...clientsData, ...indicatorsData]

      processedData.sort((a, b) => {
        const dateA = new Date(a.nextBirthday).getTime()
        const dateB = new Date(b.nextBirthday).getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })

      setBirthdayData(processedData)
    } catch (error) {
      console.error('Error fetching birthday data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchChildbirthData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          id,
          childbirthDate,
          rn_birth_date,
          isProBono,
          isFinanced,
          status,
          clients (
            name,
            document,
            phone
          )
        `)
        .not('childbirthDate', 'is', null)

      if (error) throw error

      if (data) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const processedData: ChildbirthReportItem[] = data.map((item: any) => {
          // Garante que a data seja interpretada corretamente no fuso local
          const [year, month, day] = item.childbirthDate.split('-').map(Number);
          const cbDate = new Date(year, month - 1, day);
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const diffTime = cbDate.getTime() - today.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); // Usar round para evitar erros de arredondamento próximos à meia-noite
          
          return {
            id: item.id,
            clientName: item.clients?.name || 'Cliente não encontrado',
            document: item.clients?.document || 'N/A',
            phone: item.clients?.phone || 'N/A',
            childbirthDate: item.childbirthDate,
            rn_birth_date: item.rn_birth_date,
            daysRemaining: diffDays,
            isProBono: item.isProBono || false,
            isFinanced: item.isFinanced || false,
            status: item.status || 'Aberto'
          }
        })

        processedData.sort((a, b) => {
          const dateA = new Date(a.childbirthDate).getTime()
          const dateB = new Date(b.childbirthDate).getTime()
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
        })

        setChildbirthData(processedData)
      }
    } catch (error) {
      console.error('Error fetching childbirth data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDeadlineData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const [deadlinesRes, processesRes, contractsRes, clientsRes] = await Promise.all([
        supabase.from('process_deadlines').select('*'),
        supabase.from('processes').select('id, number, client'),
        supabase.from('contracts').select('processNumber, client_id'),
        supabase.from('clients').select('id, name')
      ])

      if (deadlinesRes.error) throw deadlinesRes.error

      if (deadlinesRes.data) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const processedData: DeadlineReportItem[] = deadlinesRes.data.map((item: any) => {
          const dlDate = new Date(item.deadline_date)
          dlDate.setHours(0, 0, 0, 0)
          
          const diffTime = dlDate.getTime() - today.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

          // Tenta encontrar o processo vinculado para este prazo
          const process = (processesRes.data || []).find((p: any) => p.id === item.process_id);
          // Tenta encontrar o cliente real vinculado via contrato
          const contract = process ? (contractsRes.data || []).find((c: any) => c.processNumber === process.number) : null;
          const client = contract ? (clientsRes.data || []).find((cl: any) => cl.id === contract.client_id) : null;

          return {
            id: item.id,
            processNumber: process ? process.number : 'Sem número',
            clientName: client ? client.name : (process ? process.client : 'Cliente não informado'),
            deadlineDate: item.deadline_date,
            daysRemaining: diffDays,
            description: item.description
          }
        })

        processedData.sort((a, b) => {
          const dateA = new Date(a.deadlineDate).getTime()
          const dateB = new Date(b.deadlineDate).getTime()
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
        })

        setDeadlineData(processedData)
      }
    } catch (error) {
      console.error('Error fetching deadline data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCommissionData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          id,
          contractValue,
          commissionPercent,
          commissionValue,
          status,
          contractDate,
          base_comissao,
          clients (name),
          indicators (name),
          products (name)
        `)
        .not('commissionValue', 'eq', 0)

      if (error) throw error

      if (data) {
        const processedData: CommissionReportItem[] = data.map((item: any) => {
          // Calcula o saldo devedor para determinar se está quitado
          const totalCommission = item.base_comissao * (item.commissionPercent / 100.0);
          // Nota: Como não temos os pagamentos aqui facilmente, vamos assumir que o status original é o guia, 
          // mas se o usuário quiser que o status mude dinamicamente, precisaríamos buscar os pagamentos.
          // Por hora, vamos manter a lógica baseada no campo 'status' do contrato, 
          // mas garantindo que se o status for 'Aberto' e o valor for zero, ele possa ser tratado.
          
          return {
            id: item.id,
            clientName: item.clients?.name || 'N/A',
            productName: item.products?.name || 'N/A',
            indicatorName: item.indicators?.name || 'Sem Indicador',
            contractValue: item.contractValue || 0,
            base_comissao: item.base_comissao || 0,
            commissionPercent: item.commissionPercent || 0,
            commissionValue: item.commissionValue || 0,
            status: item.commissionPaid ? 'Quitado' : (item.status || 'Aberto'),
            contractDate: item.contractDate
          }
        })

        processedData.sort((a, b) => {
          const dateA = new Date(a.contractDate).getTime()
          const dateB = new Date(b.contractDate).getTime()
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
        })

        setCommissionData(processedData)
      }
    } catch (error) {
      console.error('Error fetching commission data:', error)
    } finally {
      setLoading(false)
    }
  }

  const [paymentDate, setPaymentDate] = useState('')
  const [paymentValue, setPaymentValue] = useState(0)

  const handleRegisterPayment = async () => {
    if (!isSupabaseConfigured || !selectedGps) return
    
    try {
      const { error } = await supabase
        .from('contracts')
        .update({ 
          gpsPaid: true, 
          gps_payment_date: paymentDate,
          gps_value: paymentValue 
        })
        .eq('id', selectedGps.id)

      if (error) throw error
      
      setIsPaymentModalOpen(false)
      setSelectedGps(null)
      // Refresh data
      fetchGpsData()
    } catch (error) {
      console.error('Error registering payment:', error)
      alert('Erro ao registrar pagamento.')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleHeader 
          icon={BarChart3}
          title="Relatórios" 
          description="Acompanhe métricas e relatórios estratégicos."
        />

        {!isSupabaseConfigured && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800">
            <AlertCircle className="text-amber-500 shrink-0" size={20} />
            <p className="text-sm">
              <strong>Supabase não configurado:</strong> Configure as variáveis de ambiente no painel do AI Studio para visualizar os dados reais.
            </p>
          </div>
        )}

        {/* Report Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <button
            onClick={() => setActiveReport('deadlines')}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeReport === 'deadlines'
                ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20'
                : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
              activeReport === 'deadlines' ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <Clock size={20} />
            </div>
            <h3 className={`font-bold ${activeReport === 'deadlines' ? 'text-indigo-900' : 'text-slate-700'}`}>
              Prazos Processuais
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Processos próximos do vencimento
            </p>
          </button>

          <button
            onClick={() => setActiveReport('childbirth')}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeReport === 'childbirth'
                ? 'bg-rose-50 border-rose-200 ring-2 ring-rose-500/20'
                : 'bg-white border-slate-200 hover:border-rose-200 hover:bg-slate-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
              activeReport === 'childbirth' ? 'bg-rose-200 text-rose-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <Baby size={20} />
            </div>
            <h3 className={`font-bold ${activeReport === 'childbirth' ? 'text-rose-900' : 'text-slate-700'}`}>
              Previsão de Partos
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Salário-Maternidade (Financiamento)
            </p>
          </button>

          <button
            onClick={() => setActiveReport('birthdays')}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeReport === 'birthdays'
                ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/20'
                : 'bg-white border-slate-200 hover:border-emerald-200 hover:bg-slate-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
              activeReport === 'birthdays' ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <Gift size={20} />
            </div>
            <h3 className={`font-bold ${activeReport === 'birthdays' ? 'text-emerald-900' : 'text-slate-700'}`}>
              Aniversariantes
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Próximos aniversários de clientes
            </p>
          </button>

          <button
            onClick={() => setActiveReport('commissions')}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeReport === 'commissions'
                ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/20'
                : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-slate-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
              activeReport === 'commissions' ? 'bg-amber-200 text-amber-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <Coins size={20} />
            </div>
            <h3 className={`font-bold ${activeReport === 'commissions' ? 'text-amber-900' : 'text-slate-700'}`}>
              Comissões
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Relatório de comissões por indicador
            </p>
          </button>

          <button
            onClick={() => setActiveReport('gps')}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeReport === 'gps'
                ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/20'
                : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
              activeReport === 'gps' ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <Calendar size={20} />
            </div>
            <h3 className={`font-bold ${activeReport === 'gps' ? 'text-blue-900' : 'text-slate-700'}`}>
              Controle de GPS
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Vencimentos e pagamentos de GPS
            </p>
          </button>

          <button
            onClick={() => setActiveReport('recebimentos')}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeReport === 'recebimentos'
                ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/20'
                : 'bg-white border-slate-200 hover:border-emerald-200 hover:bg-slate-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
              activeReport === 'recebimentos' ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <Receipt size={20} />
            </div>
            <h3 className={`font-bold ${activeReport === 'recebimentos' ? 'text-emerald-900' : 'text-slate-700'}`}>
              Recebimentos
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Extrato de entradas por período
            </p>
          </button>
          <button
            onClick={() => setActiveReport('a-receber')}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeReport === 'a-receber'
                ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-500/20'
                : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-slate-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
              activeReport === 'a-receber' ? 'bg-amber-200 text-amber-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <Coins size={20} />
            </div>
            <h3 className={`font-bold ${activeReport === 'a-receber' ? 'text-amber-900' : 'text-slate-700'}`}>
              A Receber
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Controle de valores a receber
            </p>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                activeReport === 'deadlines' ? 'bg-indigo-100 text-indigo-600' : 
                activeReport === 'childbirth' ? 'bg-rose-100 text-rose-600' :
                activeReport === 'birthdays' ? 'bg-emerald-100 text-emerald-600' :
                activeReport === 'gps' ? 'bg-blue-100 text-blue-600' :
                activeReport === 'recebimentos' ? 'bg-emerald-100 text-emerald-600' :
                'bg-amber-100 text-amber-600'
              }`}>
                {activeReport === 'deadlines' ? <Clock size={20} /> : 
                 activeReport === 'childbirth' ? <Baby size={20} /> :
                 activeReport === 'birthdays' ? <Gift size={20} /> :
                 activeReport === 'gps' ? <Calendar size={20} /> :
                 activeReport === 'recebimentos' ? <Receipt size={20} /> :
                 <Coins size={20} />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {activeReport === 'deadlines' ? 'Relatório de Prazos' : 
                   activeReport === 'childbirth' ? 'Previsão de Partos' :
                   activeReport === 'birthdays' ? 'Relatório de Aniversariantes' :
                   activeReport === 'gps' ? 'Relatório de Controle de GPS' :
                   activeReport === 'recebimentos' ? 'Relatório de Recebimentos' :
                   activeReport === 'a-receber' ? 'Relatório de Contas a Receber' : 'Relatório de Comissões'}
                </h2>
                <p className="text-sm text-slate-500">
                  {activeReport === 'deadlines' 
                    ? 'Acompanhamento de vencimentos processuais' 
                    : activeReport === 'childbirth'
                    ? 'Acompanhamento para modalidade Financiamento'
                    : activeReport === 'birthdays'
                    ? 'Acompanhamento de aniversários de clientes'
                    : activeReport === 'gps'
                    ? 'Acompanhamento de vencimentos e pagamentos de GPS'
                    : activeReport === 'recebimentos'
                    ? 'Extrato detalhado de recebimentos e entradas por período'
                    : activeReport === 'a-receber'
                    ? 'Acompanhamento de valores pendentes de recebimento'
                    : 'Acompanhamento de comissões devidas a indicadores'}
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {activeReport === 'childbirth' && (
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setChildbirthFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      childbirthFilter === 'all' 
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setChildbirthFilter('financed')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      childbirthFilter === 'financed' 
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Financiado
                  </button>
                  <button
                    onClick={() => setChildbirthFilter('probono')}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      childbirthFilter === 'probono' 
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Pro Bono
                  </button>
                </div>
              )}

              {activeReport === 'recebimentos' && (
                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-600 px-1">
                    <span>De:</span>
                    <input
                      type="date"
                      value={recebimentosStartDate}
                      onChange={(e) => setRecebimentosStartDate(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-600 px-1">
                    <span>Até:</span>
                    <input
                      type="date"
                      value={recebimentosEndDate}
                      onChange={(e) => setRecebimentosEndDate(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-600 px-1">
                    <span>Conta:</span>
                    <select
                      value={recebimentosAccountFilter}
                      onChange={(e) => setRecebimentosAccountFilter(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="all">Todas</option>
                      {accountsList.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-600 px-1">
                    <span>TAG:</span>
                    <input
                      type="text"
                      placeholder="Filtrar por tag..."
                      value={recebimentosTagFilter}
                      onChange={(e) => setRecebimentosTagFilter(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs w-28 sm:w-32"
                    />
                  </div>
                </div>
              )}

              {activeReport === 'gps' && (
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setGpsFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      gpsFilter === 'all' 
                        ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setGpsFilter('paid')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      gpsFilter === 'paid' 
                        ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Pagas
                  </button>
                  <button
                    onClick={() => setGpsFilter('unpaid')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      gpsFilter === 'unpaid' 
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Não Pagas
                  </button>
                  <div className="w-px h-5 bg-slate-200 mx-0.5 hidden sm:block"></div>
                  <button
                    onClick={() => setGpsFilter('financed')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      gpsFilter === 'financed' 
                        ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Financiados
                  </button>
                  <button
                    onClick={() => setGpsFilter('normal')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      gpsFilter === 'normal' 
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => setGpsFilter('divergence')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      gpsFilter === 'divergence' 
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Divergências
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <button
                  onClick={() => setSortOrder('asc')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    sortOrder === 'asc' 
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ArrowUpCircle size={15} />
                  Crescente
                </button>
                <button
                  onClick={() => setSortOrder('desc')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    sortOrder === 'desc' 
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ArrowDownCircle size={15} />
                  Decrescente
                </button>
              </div>
            </div>
          </div>

          {activeReport === 'a-receber' && (
            <div className="p-4 sm:p-6 pb-2 space-y-4">
              {(() => {
                const totalPendente = aReceberData.reduce((acc, item) => acc + (Number(item.amount || 0) - Number(item.amountPaid || 0)), 0);
                
                const vencendoEsteMes = aReceberData.filter(item => {
                  if (!item.dueDate) return false;
                  const d = new Date(item.dueDate);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).reduce((acc, item) => acc + (Number(item.amount || 0) - Number(item.amountPaid || 0)), 0);

                const totalEmAtraso = aReceberData.filter(item => {
                  if (!item.dueDate) return false;
                  const d = new Date(item.dueDate);
                  const now = new Date();
                  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  return dDate < nowDate;
                }).reduce((acc, item) => acc + (Number(item.amount || 0) - Number(item.amountPaid || 0)), 0);

                const totalResiduais = aReceberData.filter(item => {
                  const paid = Number(item.amountPaid || 0);
                  const total = Number(item.amount || 0);
                  return paid > 0 && paid < total;
                }).reduce((acc, item) => acc + (Number(item.amount || 0) - Number(item.amountPaid || 0)), 0);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {/* Card 1: Total Pendente */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Pendente</span>
                          <button 
                            onClick={(e) => { e.preventDefault(); toggleVisibility('reports_total_pendente'); }} 
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title={isVisible('reports_total_pendente') ? "Ocultar valor" : "Mostrar valor"}
                          >
                            {isVisible('reports_total_pendente') ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate leading-none" title={formatCurrency(totalPendente, isVisible('reports_total_pendente'))}>
                          {formatCurrency(totalPendente, isVisible('reports_total_pendente'))}
                        </h3>
                        <span className="text-[11px] text-slate-400 mt-1 block">{aReceberData.length} parcelas em aberto</span>
                      </div>
                      <div className="p-2.5 sm:p-3 rounded-xl bg-slate-100 text-slate-700 ml-3 shrink-0">
                        <Coins className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Card 2: Vencendo Este Mês */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-sm flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block">Vencendo este mês</span>
                          <button 
                            onClick={(e) => { e.preventDefault(); toggleVisibility('reports_vencendo'); }} 
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title={isVisible('reports_vencendo') ? "Ocultar valor" : "Mostrar valor"}
                          >
                            {isVisible('reports_vencendo') ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-indigo-600 truncate leading-none" title={formatCurrency(vencendoEsteMes, isVisible('reports_vencendo'))}>
                          {formatCurrency(vencendoEsteMes, isVisible('reports_vencendo'))}
                        </h3>
                        <span className="text-[11px] text-indigo-400 mt-1 block">Previsão corrente</span>
                      </div>
                      <div className="p-2.5 sm:p-3 rounded-xl bg-indigo-50 text-indigo-600 ml-3 shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Card 3: Total em Atraso */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider block">Total em Atraso</span>
                          <button 
                            onClick={(e) => { e.preventDefault(); toggleVisibility('reports_atraso'); }} 
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title={isVisible('reports_atraso') ? "Ocultar valor" : "Mostrar valor"}
                          >
                            {isVisible('reports_atraso') ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-rose-600 truncate leading-none" title={formatCurrency(totalEmAtraso, isVisible('reports_atraso'))}>
                          {formatCurrency(totalEmAtraso, isVisible('reports_atraso'))}
                        </h3>
                        <span className="text-[11px] text-rose-400 mt-1 block">Requer cobrança</span>
                      </div>
                      <div className="p-2.5 sm:p-3 rounded-xl bg-rose-50 text-rose-600 ml-3 shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Card 4: Residuais e Parciais */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">Saldos Residuais</span>
                          <button 
                            onClick={(e) => { e.preventDefault(); toggleVisibility('reports_residuais'); }} 
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title={isVisible('reports_residuais') ? "Ocultar valor" : "Mostrar valor"}
                          >
                            {isVisible('reports_residuais') ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-amber-600 truncate leading-none" title={formatCurrency(totalResiduais, isVisible('reports_residuais'))}>
                          {formatCurrency(totalResiduais, isVisible('reports_residuais'))}
                        </h3>
                        <span className="text-[11px] text-amber-500 mt-1 block">Pagamentos parciais</span>
                      </div>
                      <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50 text-amber-600 ml-3 shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Innovative Filter Bar */}
              <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200/95 space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <input
                      type="text"
                      placeholder="Pesquisar por cliente ou nº do processo..."
                      value={aReceberSearch}
                      onChange={(e) => setAReceberSearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 px-4 py-2.5 pl-9 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none shadow-2xs"
                    />
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  {/* Toggle All Periods */}
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="relative flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={aReceberShowAllPeriods}
                        onChange={(e) => setAReceberShowAllPeriods(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                      />
                      <span>Exibir Todos os Períodos (Passados e Futuros)</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2 border-t border-slate-200/60">
                  {/* Period Filters (Conditional) */}
                  {!aReceberShowAllPeriods ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs">
                        <span className="text-slate-400 uppercase tracking-wider text-[10px] shrink-0">Início:</span>
                        <input
                          type="date"
                          value={aReceberStartDate}
                          onChange={(e) => setAReceberStartDate(e.target.value)}
                          className="bg-transparent border-0 p-0 text-xs font-semibold text-slate-800 focus:ring-0 outline-none w-full sm:w-28 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs">
                        <span className="text-slate-400 uppercase tracking-wider text-[10px] shrink-0">Fim:</span>
                        <input
                          type="date"
                          value={aReceberEndDate}
                          onChange={(e) => setAReceberEndDate(e.target.value)}
                          className="bg-transparent border-0 p-0 text-xs font-semibold text-slate-800 focus:ring-0 outline-none w-full sm:w-28 cursor-pointer"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Exibindo todos os registros em aberto e residuais sem restrição de datas.
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 justify-end">
                    {/* Status Filter Buttons */}
                    <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                      <button
                        onClick={() => setAReceberStatusFilter('all')}
                        className={cn(
                          "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-center",
                          aReceberStatusFilter === 'all'
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        Todas
                      </button>
                      <button
                        onClick={() => setAReceberStatusFilter('pending')}
                        className={cn(
                          "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-center",
                          aReceberStatusFilter === 'pending'
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "text-slate-600 hover:text-indigo-600"
                        )}
                      >
                        A Vencer
                      </button>
                      <button
                        onClick={() => setAReceberStatusFilter('overdue')}
                        className={cn(
                          "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-center",
                          aReceberStatusFilter === 'overdue'
                            ? "bg-rose-600 text-white shadow-2xs"
                            : "text-slate-600 hover:text-rose-600"
                        )}
                      >
                        Atrasadas
                      </button>
                    </div>

                    {/* Tag Filter Input */}
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs w-full sm:w-48">
                      <span className="text-slate-400 uppercase tracking-wider text-[10px] shrink-0">TAG:</span>
                      <input
                        type="text"
                        placeholder="Filtrar por tag..."
                        value={aReceberTagFilter}
                        onChange={(e) => setAReceberTagFilter(e.target.value)}
                        className="bg-transparent border-0 p-0 text-xs text-slate-700 focus:ring-0 outline-none w-full font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeReport === 'recebimentos' && (
            <div className="p-4 sm:p-6 pb-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
                <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Total Recebido no Período</div>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-600">
                      {formatCurrency(recebimentosData.reduce((acc, item) => acc + item.amount, 0), isVisible('reports_recebimentos'))}
                    </div>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                    <Receipt size={22} />
                  </div>
                </div>
                <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Total de Lançamentos</div>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      {recebimentosData.length}
                    </div>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                    <BarChart3 size={22} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeReport === 'gps' && (
            (() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const tomorrow = new Date(today);
              tomorrow.setDate(today.getDate() + 1);
              
              return (
                <div className="p-4 sm:p-6 pb-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { title: 'Total Pendente', value: gpsData.filter(item => item.status?.toLowerCase().trim() !== 'cancelado').reduce((acc, item) => acc + (item.gps_value - (item.gps_paid_value || 0)), 0), color: '#f43f5e', active: true },
                      { title: 'Total Pago', value: gpsData.filter(item => item.status?.toLowerCase().trim() !== 'cancelado').reduce((acc, item) => acc + (item.gps_paid_value || 0), 0), color: '#10b981', active: false },
                      { title: 'Total Geral', value: gpsData.filter(item => item.status?.toLowerCase().trim() !== 'cancelado').reduce((acc, item) => acc + (item.gps_value || 0), 0), color: '#6366f1', active: false }
                    ].map((item, index) => (
                      <div key={index} className={`bg-white p-4 rounded-2xl shadow-sm border ${item.active ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'} flex items-center justify-between`}>
                        <div className="flex flex-col">
                          <div className="text-xs font-medium text-slate-500 mb-1">{item.title}</div>
                          <div className="text-lg sm:text-xl font-bold text-slate-900">{formatCurrency(item.value, isVisible('reports_gps'))}</div>
                        </div>
                        <div className="h-11 w-11 sm:h-12 sm:w-12 shrink-0">
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                              <Pie
                                data={[{ value: item.value }, { value: Math.max(0, gpsData.reduce((acc, i) => acc + (i.gps_value || 0), 0) - item.value) }]}
                                innerRadius={15}
                                outerRadius={19}
                                paddingAngle={0}
                                dataKey="value"
                                stroke="none"
                              >
                                <Cell fill={item.color} />
                                <Cell fill="#e2e8f0" />
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse hidden md:table">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  {activeReport === 'gps' ? (
                    <>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">Cliente</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/6">Data Parto</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/6">Req. INSS</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/12">Status</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/12">Previsão</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/12">Pagto</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-1/6">Valor Previsto</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-1/6">Valor Pago</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-1/6">Diferença</th>
                    </>
                  ) : activeReport === 'recebimentos' ? (
                    <>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data do Recebimento</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente / Parte</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição / Título</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Conta Creditada</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoria</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Valor Recebido</th>
                    </>
                  ) : activeReport === 'deadlines' ? (
                    <>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Processo</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data do Prazo</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Dias Restantes</th>
                    </>
                  ) : activeReport === 'a-receber' ? (
                    <>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Venc.</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente / Contrato</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Processo</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">TAGs</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                    </>
                  ) : activeReport === 'childbirth' ? (
                    <>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Modalidade</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">CPF</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">WhatsApp</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Previsão Parto</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Parto</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Dias Faltantes</th>
                    </>
                  ) : activeReport === 'birthdays' ? (
                    <>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">CPF</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">WhatsApp</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data de Nasc.</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Idade</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Dias Faltantes</th>
                    </>
                  ) : (
                    <>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Indicador</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente / Produto</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Contrato</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Base Comissão</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">%</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Comissão</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-slate-500 mt-2">Carregando relatório...</p>
                    </td>
                  </tr>
                ) : reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Nenhum registro encontrado para este relatório.
                    </td>
                  </tr>
                ) : (
                  reportRows.map((item: any, index) => {
                    const columns = getReportColumns(item)
                    return (
                      <motion.tr
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={item.id}
                        className={cn(
                          "hover:bg-slate-50/50 transition-colors",
                          (activeReport === 'childbirth' && item.status?.toLowerCase().trim() === 'cancelado') ||
                          (activeReport === 'gps' && item.status?.toLowerCase().trim() === 'cancelado') ||
                          (activeReport === 'commissions' && item.status?.toLowerCase().trim() === 'cancelado')
                            ? "opacity-60 line-through text-slate-400" : ""
                        )}
                      >
                        {columns.map((column) => (
                          <td key={column.key} className={cn("p-4", column.cellClassName)}>{column.value}</td>
                        ))}
                      </motion.tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-slate-500 mt-2">Carregando relatório...</p>
              </div>
            ) : reportRows.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Nenhum registro encontrado para este relatório.
              </div>
            ) : (
              reportRows.map((item: any) => (
                <div key={item.id} className="p-4 space-y-3">
                  {getReportColumns(item).map((column) => (
                    <ReportCardField key={column.key} label={column.label} value={column.value} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
        {/* Modal para Registro de Pagamento */}
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title="Confirmar Registro de Pagamento"
        >
          {selectedGps && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                <p className="text-sm text-slate-600"><strong>Cliente:</strong> {selectedGps.clientName}</p>
                <p className="text-sm text-slate-600"><strong>Previsão:</strong> {formatDate(selectedGps.gps_forecast_date)}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Valor da GPS (R$)</label>
                <CurrencyInput
                  value={paymentValue}
                  onChange={setPaymentValue}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data do Pagamento</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegisterPayment}
                  className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </div>
          )}
        </Modal>

      </div>
    </DashboardLayout>
  )
}

export default function RelatoriosPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    }>
      <RelatoriosPageContent />
    </Suspense>
  )
}
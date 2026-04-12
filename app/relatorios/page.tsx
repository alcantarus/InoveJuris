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
  AlertTriangle
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import DashboardLayout from '../dashboard-layout'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import { usePrivacy } from '@/components/providers/PrivacyProvider'

interface ChildbirthReportItem {
  id: number
  clientName: string
  document: string
  phone: string
  childbirthDate: string
  daysRemaining: number
  isProBono: boolean
  isFinanced: boolean
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

type ReportType = 'childbirth' | 'deadlines' | 'birthdays' | 'commissions' | 'gps'

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
  const { isVisible } = usePrivacy()
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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedGps, setSelectedGps] = useState<any>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(true)

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport])

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

        processedData.sort((a: any, b: any) => {
          if (a.gpsPaid !== b.gpsPaid) {
            return a.gpsPaid ? 1 : -1;
          }
          return new Date(a.gps_forecast_date || '9999-12-31').getTime() - new Date(b.gps_forecast_date || '9999-12-31').getTime();
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
          isProBono,
          isFinanced,
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
          const cbDate = new Date(item.childbirthDate)
          cbDate.setHours(0, 0, 0, 0)
          
          const diffTime = cbDate.getTime() - today.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

          return {
            id: item.id,
            clientName: item.clients?.name || 'Cliente não encontrado',
            document: item.clients?.document || 'N/A',
            phone: item.clients?.phone || 'N/A',
            childbirthDate: item.childbirthDate,
            daysRemaining: diffDays,
            isProBono: item.isProBono || false,
            isFinanced: item.isFinanced || false
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                activeReport === 'deadlines' ? 'bg-indigo-100 text-indigo-600' : 
                activeReport === 'childbirth' ? 'bg-rose-100 text-rose-600' :
                activeReport === 'birthdays' ? 'bg-emerald-100 text-emerald-600' :
                'bg-amber-100 text-amber-600'
              }`}>
                {activeReport === 'deadlines' ? <Clock size={20} /> : 
                 activeReport === 'childbirth' ? <Baby size={20} /> :
                 activeReport === 'birthdays' ? <Gift size={20} /> :
                 <Coins size={20} />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {activeReport === 'deadlines' ? 'Relatório de Prazos' : 
                   activeReport === 'childbirth' ? 'Previsão de Partos' :
                   activeReport === 'birthdays' ? 'Relatório de Aniversariantes' :
                   activeReport === 'gps' ? 'Relatório de Controle de GPS' :
                   'Relatório de Comissões'}
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
                    : 'Acompanhamento de comissões devidas a indicadores'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {activeReport === 'childbirth' && (
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 mr-2">
                  <button
                    onClick={() => setChildbirthFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      childbirthFilter === 'all' 
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setChildbirthFilter('financed')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      childbirthFilter === 'financed' 
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Financiado
                  </button>
                  <button
                    onClick={() => setChildbirthFilter('probono')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      childbirthFilter === 'probono' 
                        ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Pro Bono
                  </button>
                </div>
              )}

                  {activeReport === 'gps' && (
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 mr-2">
                      <button
                        onClick={() => setGpsFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          gpsFilter === 'all' 
                            ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        onClick={() => setGpsFilter('paid')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          gpsFilter === 'paid' 
                            ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Pagas
                      </button>
                      <button
                        onClick={() => setGpsFilter('unpaid')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          gpsFilter === 'unpaid' 
                            ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Não Pagas
                      </button>
                      <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
                      <button
                        onClick={() => setGpsFilter('financed')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          gpsFilter === 'financed' 
                            ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Financiados
                      </button>
                      <button
                        onClick={() => setGpsFilter('normal')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          gpsFilter === 'normal' 
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Normal
                      </button>
                      <button
                        onClick={() => setGpsFilter('divergence')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          gpsFilter === 'divergence' 
                            ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Divergências
                      </button>
                    </div>
                  )}

              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setSortOrder('asc')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortOrder === 'asc' 
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ArrowUpCircle size={16} />
                Crescente
              </button>
              <button
                onClick={() => setSortOrder('desc')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortOrder === 'desc' 
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ArrowDownCircle size={16} />
                Decrescente
              </button>
            </div>
          </div>
        </div>

        {activeReport === 'gps' && (
          (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            
            const isDueSoon = gpsData.some(item => !item.gpsPaid && item.gps_forecast_date && new Date(item.gps_forecast_date) > today && new Date(item.gps_forecast_date) <= tomorrow);
            return (
            <div className="flex justify-center mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl">
                {[
                  { title: 'Total Pendente', value: gpsData.filter(item => item.status?.toLowerCase().trim() !== 'cancelado').reduce((acc, item) => acc + (item.gps_value - (item.gps_paid_value || 0)), 0), color: '#f43f5e', active: true },
                  { title: 'Total Pago', value: gpsData.filter(item => item.status?.toLowerCase().trim() !== 'cancelado').reduce((acc, item) => acc + (item.gps_paid_value || 0), 0), color: '#10b981', active: false },
                  { title: 'Total Geral', value: gpsData.filter(item => item.status?.toLowerCase().trim() !== 'cancelado').reduce((acc, item) => acc + (item.gps_value || 0), 0), color: '#6366f1', active: false }
                ].map((item, index) => (
                  <div key={index} className={`bg-white p-4 rounded-2xl shadow-sm border ${item.active ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'} flex items-center justify-between`}>
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-slate-500 mb-1">{item.title}</div>
                      <div className="text-xl font-bold text-slate-900">{formatCurrency(item.value, isVisible('reports_gps'))}</div>
                    </div>
                    <div className="h-12 w-12 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[{ value: item.value }, { value: gpsData.reduce((acc, i) => acc + (i.gps_value || 0), 0) - item.value }]}
                            innerRadius={16}
                            outerRadius={20}
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
            <table className="w-full text-left border-collapse">
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
                  ) : activeReport === 'deadlines' ? (
                    <>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Processo</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data do Prazo</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Dias Restantes</th>
                    </>
                  ) : activeReport === 'childbirth' ? (
                    <>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Modalidade</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">CPF</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">WhatsApp</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data do Parto</th>
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
                ) : (
                  activeReport === 'deadlines' ? deadlineData : 
                  activeReport === 'childbirth' ? childbirthData.filter(item => {
                    if (childbirthFilter === 'all') return true;
                    if (childbirthFilter === 'probono') return item.isProBono;
                    if (childbirthFilter === 'financed') return item.isFinanced;
                    return true;
                  }) : 
                  activeReport === 'birthdays' ? birthdayData : 
                  activeReport === 'gps' ? gpsData.filter(item => {
                    if (gpsFilter === 'all') return true;
                    if (gpsFilter === 'paid') return item.gpsPaid;
                    if (gpsFilter === 'unpaid') return !item.gpsPaid;
                    if (gpsFilter === 'financed') return item.isFinanced;
                    if (gpsFilter === 'normal') return !item.isFinanced;
                    if (gpsFilter === 'divergence') return item.gps_value !== (item.gps_paid_value || 0);
                    return true;
                  }) : 
                  commissionData
                ).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Nenhum registro encontrado para este relatório.
                    </td>
                  </tr>
                ) : (
                  (
                    activeReport === 'deadlines' ? deadlineData : 
                    activeReport === 'childbirth' ? childbirthData.filter(item => {
                      if (childbirthFilter === 'all') return true;
                      if (childbirthFilter === 'probono') return item.isProBono;
                      if (childbirthFilter === 'financed') return item.isFinanced;
                      return true;
                    }) : 
                    activeReport === 'birthdays' ? birthdayData : 
                    activeReport === 'gps' ? gpsData.filter(item => {
                      if (gpsFilter === 'all') return true;
                      if (gpsFilter === 'paid') return item.gpsPaid;
                      if (gpsFilter === 'unpaid') return !item.gpsPaid;
                      if (gpsFilter === 'financed') return item.isFinanced;
                      if (gpsFilter === 'normal') return !item.isFinanced;
                      return true;
                    }) :
                    commissionData
                  ).map((item: any, index) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={item.id} 
                      className={cn(
                        "hover:bg-slate-50/50 transition-colors",
                        item.status === 'Cancelado' && "opacity-60 line-through"
                      )}
                    >
                      {activeReport === 'deadlines' ? (
                        <>
                          <td className="p-4 font-medium text-slate-900">{item.processNumber}</td>
                          <td className="p-4 text-slate-600">{item.clientName}</td>
                          <td className="p-4 text-slate-600">{item.description || '-'}</td>
                          <td className="p-4 text-slate-900 font-medium">
                            {formatDate(item.deadlineDate)}
                          </td>
                          <td className="p-4 text-right">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              item.daysRemaining < 0 
                                ? 'bg-slate-100 text-slate-600' // Vencido
                                : item.daysRemaining <= 5
                                  ? 'bg-rose-100 text-rose-700' // Crítico (menos de 5 dias)
                                  : item.daysRemaining <= 15
                                    ? 'bg-amber-100 text-amber-700' // Atenção (5 a 15 dias)
                                    : 'bg-emerald-100 text-emerald-700' // Seguro
                            }`}>
                              {item.daysRemaining < 0 
                                ? `Venceu há ${Math.abs(item.daysRemaining)} dias` 
                                : item.daysRemaining === 0
                                  ? 'Vence hoje!'
                                  : `Faltam ${item.daysRemaining} dias`}
                            </span>
                          </td>
                        </>
                      ) : activeReport === 'childbirth' ? (
                        <>
                          <td className="p-4 font-medium text-slate-900">{item.clientName}</td>
                          <td className="p-4">
                            {item.isProBono ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
                                Pro Bono
                              </span>
                            ) : item.isFinanced ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700">
                                Financiado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                                Normal
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-600">{item.document}</td>
                          <td className="p-4 text-slate-600">{item.phone}</td>
                          <td className="p-4 text-slate-900 font-medium">
                            {formatDate(item.childbirthDate)}
                          </td>
                          <td className="p-4 text-right">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              item.daysRemaining < 0 
                                ? 'bg-slate-100 text-slate-600' 
                                : item.daysRemaining <= 30
                                  ? 'bg-rose-100 text-rose-700' 
                                  : item.daysRemaining <= 90
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-emerald-100 text-emerald-700' 
                            }`}>
                              {item.daysRemaining < 0 
                                ? `Ocorreu há ${Math.abs(item.daysRemaining)} dias` 
                                : item.daysRemaining === 0
                                  ? 'É hoje!'
                                  : `Faltam ${item.daysRemaining} dias`}
                            </span>
                          </td>
                        </>
                      ) : activeReport === 'birthdays' ? (
                        <>
                          <td className="p-4 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              {item.clientName}
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                                item.type === 'cliente' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                              )}>
                                {item.type}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-slate-600">{item.document}</td>
                          <td className="p-4 text-slate-600">{item.phone}</td>
                          <td className="p-4 text-slate-900 font-medium">
                            {formatDate(item.birthDate)}
                          </td>
                          <td className="p-4 text-right text-slate-600 font-medium">
                            {item.age} anos
                          </td>
                          <td className="p-4 text-right">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              item.daysRemaining === 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : item.daysRemaining <= 7
                                  ? 'bg-rose-100 text-rose-700' 
                                  : item.daysRemaining <= 30
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-slate-100 text-slate-700' 
                            }`}>
                              {item.daysRemaining === 0
                                ? 'É hoje! 🎉'
                                : `Faltam ${item.daysRemaining} dias`}
                            </span>
                          </td>
                        </>
                      ) : activeReport === 'gps' ? (
                        <>
                          <td className="p-4">
                            <div className="font-medium text-slate-900">{item.clientName}</div>
                            {item.isFinanced ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 mt-1">
                                Financiado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 mt-1">
                                Normal
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-600 font-medium">{formatDate(item.childbirthDate)}</td>
                          <td className="p-4">
                            <StatusBadge protocolNumber={item.protocolNumber} />
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              item.gpsPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {item.gpsPaid ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 font-medium text-slate-900">
                              {formatDate(item.gps_forecast_date)}
                            </div>
                          </td>
                          <td className="p-4">
                            {item.status?.toLowerCase().trim() === 'cancelado' ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">
                                Cancelado
                              </span>
                            ) : item.gpsPaid ? (
                              <span className="text-slate-600 font-medium">{formatDate(item.gps_payment_date)}</span>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedGps(item)
                                  setIsPaymentModalOpen(true)
                                }}
                                className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Registrar
                              </button>
                            )}
                          </td>
                          <td className="p-4 text-right font-medium text-slate-900">
                            {formatCurrency(item.gps_value, isVisible('reports_gps'))}
                          </td>
                          <td className="p-4 text-right font-medium text-emerald-600">
                            {formatCurrency(item.gps_paid_value, isVisible('reports_gps'))}
                          </td>
                          <td className="p-4 text-right font-bold text-slate-900">
                            {formatCurrency(item.gps_value - (item.gps_paid_value || 0), isVisible('reports_gps'))}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-4 font-bold text-slate-900">{item.indicatorName}</td>
                          <td className="p-4">
                            <div className="text-sm font-medium text-slate-900">{item.clientName}</div>
                            <div className="text-xs text-slate-500">{item.productName}</div>
                          </td>
                          <td className="p-4 text-slate-600">
                            {formatCurrency(item.contractValue, isVisible('reports_commissions'))}
                          </td>
                          <td className="p-4 text-slate-600">
                            {formatCurrency(item.base_comissao, isVisible('reports_commissions'))}
                          </td>
                          <td className="p-4 text-slate-600 font-medium">{item.commissionPercent}%</td>
                          <td className="p-4 text-indigo-600 font-bold">
                            {formatCurrency(item.commissionValue, isVisible('reports_commissions'))}
                          </td>
                          <td className="p-4 text-right">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              item.status === 'Quitado' ? "bg-emerald-100 text-emerald-700" :
                              item.status === 'Cancelado' ? "bg-rose-100 text-rose-700" :
                              "bg-amber-100 text-amber-700"
                            )}>
                              {item.status}
                            </span>
                          </td>
                        </>
                      )}
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
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

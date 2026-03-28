'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import DashboardLayout from './dashboard-layout'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import { AutoResizeText } from '@/components/ui/AutoResizeText'
import { 
  Users, 
  FileText, 
  TrendingUp, 
  AlertCircle,
  Clock,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  TrendingDown,
  AlertOctagon,
  DollarSign,
  Database,
  Heart,
  Filter,
  Target,
  Zap,
  BarChart3,
  RotateCcw,
  Sparkles,
  BrainCircuit,
  ShieldAlert,
  AlertTriangle,
  Scale,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { motion } from 'motion/react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useSettings } from '@/components/providers/SettingsProvider'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import { LiquidityGapCard } from '@/components/dashboard/dynamic/LiquidityGapCard'
import { StuckProcessesCard } from '@/components/dashboard/dynamic/StuckProcessesCard'
import { DefaultRiskCard } from '@/components/dashboard/dynamic/DefaultRiskCard'
import { GPSDashboardCard } from '@/components/dashboard/GPSDashboardCard'
import GlobalActionCenter from '@/components/tasks/GlobalActionCenter'
import TodayFocusWidget from '@/components/tasks/TodayFocusWidget'
import TaskKanban from '@/components/tasks/TaskKanban'

const COLORS = ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const StatCard = ({ label, value, change, trend, icon: Icon, color, bg }: any) => {
  const { isVisible, toggleVisibility } = usePrivacy();
  const textContainerRef = useRef<HTMLDivElement>(null);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-2xl", bg, color)}>
          <Icon size={24} />
        </div>
        <button 
          onClick={() => toggleVisibility(label)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          {isVisible(label) ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>
      <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="text-3xl font-bold text-slate-900 tracking-tight overflow-hidden whitespace-nowrap" ref={textContainerRef}>
        <AutoResizeText 
          text={isVisible(label) ? value : '••••••'}
          className="text-3xl font-bold text-slate-900 tracking-tight"
          containerRef={textContainerRef}
        />
      </div>
      <p className={cn("text-sm font-medium mt-2 flex items-center gap-1", trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-slate-500')}>
        {trend === 'up' ? <ArrowUpRight size={16} /> : trend === 'down' ? <ArrowDownRight size={16} /> : null}
        {isVisible(label) ? change : '••••••'}
      </p>
    </motion.div>
  );
};

export default function Page() {
  const [mounted, setMounted] = useState(false)
  const { user } = useAuth()
  const { settings } = useSettings()
  const { isVisible, toggleVisibility } = usePrivacy()
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false)
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      const hour = new Date().getHours()
      if (hour < 12) setGreeting('Bom dia')
      else if (hour < 18) setGreeting('Boa tarde')
      else setGreeting('Boa noite')
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const [data, setData] = useState<{ 
    clients: any[], 
    processes: any[], 
    installments: any[], 
    contracts: any[],
    products: any[],
    auditLogs: any[],
    transactions: any[],
    lawAreas: any[],
    deadlines: any[],
    receivablesMetrics: any[],
    receivablesForecast: any[],
    topDefaulters: any[]
  }>({
    clients: [],
    processes: [],
    installments: [],
    contracts: [],
    products: [],
    auditLogs: [],
    transactions: [],
    lawAreas: [],
    deadlines: [],
    receivablesMetrics: [],
    receivablesForecast: [],
    topDefaulters: []
  })

  const [filters, setFilters] = useState({
    lawArea: 'all',
    contractType: 'all' // 'all', 'normal', 'pro-bono', 'financed'
  })

  const generateRuleBasedInsight = useCallback(() => {
    setIsGeneratingInsight(true)
    
    const activeProcessesCount = data.processes.filter((p: any) => p.status !== 'Arquivado').length
    const monthlyGoal = settings.dashboard_goals?.monthly_revenue || 150000
    const currentMonthRevenue = data.transactions
      .filter((t: any) => {
        const today = new Date()
        const tDate = new Date(t.date)
        return tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear()
      })
      .reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0)
    
    const stuckInProtocol = data.contracts.filter(c => c.inssProtocol && !c.inssDeferred && !c.processNumber).length
    const stuckInJudicial = data.contracts.filter(c => !c.inssProtocol && c.processNumber && c.status === 'Aberto').length
    const overdueInstallments = data.installments.filter(i => new Date(i.dueDate) < new Date() && (Number(i.amount) || 0) > (Number(i.amountPaid) || 0)).length
    
    const successfulProcesses = data.processes.filter((p: any) => p.status === 'Êxito').length
    const totalProcesses = data.processes.length
    const winRate = totalProcesses > 0 ? (successfulProcesses / totalProcesses) * 100 : 0

    let insight = ""
    
    // Revenue Insight
    if (currentMonthRevenue < monthlyGoal) {
      const diff = monthlyGoal - currentMonthRevenue
      insight += `📉 **Atenção Financeira:** Estamos a ${formatCurrency(diff, isVisible('dashboard_insight'))} da meta mensal. Foque em cobrar os ${overdueInstallments} pagamentos em atraso hoje.\n\n`
    } else {
      insight += "🚀 **Excelente Resultado:** Meta mensal atingida! Aproveite para antecipar o planejamento do próximo mês.\n\n"
    }

    // Bottleneck Insight
    if (stuckInProtocol > 5) {
      insight += `⚠️ **Gargalo Operacional:** ${stuckInProtocol} contratos parados no INSS. Sugiro um mutirão de Mandados de Segurança esta semana.\n\n`
    } else if (stuckInJudicial > 5) {
      insight += `⚖️ **Judicial:** ${stuckInJudicial} processos sem movimentação recente. Verifique se há necessidade de peticionar.\n\n`
    }

    // Strategic Insight
    if (winRate < 65) {
      insight += `🔍 **Estratégia:** Nossa taxa de êxito (${winRate.toFixed(1)}%) está abaixo da média. Que tal revisar os critérios de entrada de novas ações?\n`
    } else {
      insight += `⭐ **Qualidade:** Taxa de êxito de ${winRate.toFixed(1)}% está ótima! Continue mantendo o padrão de qualidade nas petições.\n`
    }

    if (activeProcessesCount === 0) {
      insight += "\n💡 **Dica:** Nenhum processo ativo? É hora de focar total na prospecção e marketing jurídico."
    }

    setAiInsight(insight)
    setIsGeneratingInsight(false)
  }, [data.processes, data.transactions, data.contracts, data.installments, settings.dashboard_goals?.monthly_revenue, isVisible])

  useEffect(() => {
    if (mounted && data.processes.length > 0 && !aiInsight && !isGeneratingInsight) {
      const timer = setTimeout(() => {
        generateRuleBasedInsight()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [mounted, data.processes.length, aiInsight, generateRuleBasedInsight, isGeneratingInsight])

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setMounted(true)
        return
      }

      try {
        const [clientsRes, processesRes, installmentsRes, contractsRes, productsRes, auditRes, transactionsRes, lawAreasRes, deadlinesRes, receivablesMetricsRes, receivablesForecastRes, topDefaultersRes] = await Promise.all([
          supabase.from('clients').select('*'),
          supabase.from('processes').select('*'),
          supabase.from('installments').select('*'),
          supabase.from('contracts').select('*'),
          supabase.from('products').select('*'),
          supabase.from('audit_logs').select('*, performer:performed_by(name)').order('performed_at', { ascending: false }).limit(5),
          supabase.from('financial_transactions').select('*').eq('type', 'income'),
          supabase.from('law_areas').select('*'),
          supabase.from('process_deadlines').select('*'),
          supabase.from('vw_dashboard_receivables_metrics').select('*'),
          supabase.from('vw_dashboard_receivables_forecast').select('*'),
          supabase.from('vw_dashboard_top_defaulters').select('*')
        ])

        setData({
          clients: clientsRes.data || [],
          processes: processesRes.data || [],
          installments: installmentsRes.data || [],
          contracts: contractsRes.data || [],
          products: productsRes.data || [],
          auditLogs: auditRes.data || [],
          transactions: transactionsRes.data || [],
          lawAreas: lawAreasRes.data || [],
          deadlines: [
            ...Array.from(new Map((deadlinesRes.data || []).map((d: any) => {
              // Tenta encontrar o processo vinculado para este prazo
              const process = (processesRes.data || []).find((p: any) => p.id === d.process_id);
              // Tenta encontrar o cliente real vinculado via contrato para este processo
              const contract = process ? (contractsRes.data || []).find((c: any) => c.processNumber === process.number) : null;
              const client = contract ? (clientsRes.data || []).find((cl: any) => cl.id === contract.client_id) : null;
              
              const mappedDeadline = {
                ...d,
                process_number: process ? process.number : 'N/A',
                client_name: client ? client.name : (process ? process.client : 'Sem cliente'),
                days_remaining: Math.ceil((new Date(d.deadline_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              };
              return [d.id, mappedDeadline];
            })).values())
          ],
          receivablesMetrics: receivablesMetricsRes.data || [],
          receivablesForecast: receivablesForecastRes.data || [],
          topDefaulters: topDefaultersRes.data || []
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      }
      setMounted(true)
    }

    fetchData()

    // Setup Realtime Subscriptions
    const channels = [
      supabase.channel('processes').on('postgres_changes', { event: '*', schema: 'public', table: 'processes' }, fetchData).subscribe(),
      supabase.channel('contracts').on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, fetchData).subscribe(),
      supabase.channel('installments').on('postgres_changes', { event: '*', schema: 'public', table: 'installments' }, fetchData).subscribe(),
      supabase.channel('transactions').on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, fetchData).subscribe(),
      supabase.channel('process_deadlines').on('postgres_changes', { event: '*', schema: 'public', table: 'process_deadlines' }, fetchData).subscribe(),
    ]

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel))
    }
  }, [])

  if (!mounted) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-10 w-48 bg-slate-200 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-100 rounded-2xl" />)}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // --- Filtering Logic ---
  const filteredContracts = data.contracts.filter((c: any) => {
    const matchesArea = filters.lawArea === 'all' || c.lawArea === filters.lawArea
    const matchesType = filters.contractType === 'all' || 
      (filters.contractType === 'pro-bono' && c.isProBono) ||
      (filters.contractType === 'financed' && c.isFinanced) ||
      (filters.contractType === 'normal' && !c.isProBono && !c.isFinanced)
    return matchesArea && matchesType
  })

  const filteredProcesses = data.processes.filter((p: any) => {
    // Try to link process to contract to filter by area/type
    const contract = data.contracts.find(c => c.processNumber === p.number)
    if (!contract) return filters.lawArea === 'all' && filters.contractType === 'all'
    
    const matchesArea = filters.lawArea === 'all' || contract.lawArea === filters.lawArea
    const matchesType = filters.contractType === 'all' || 
      (filters.contractType === 'pro-bono' && contract.isProBono) ||
      (filters.contractType === 'financed' && contract.isFinanced) ||
      (filters.contractType === 'normal' && !contract.isProBono && !contract.isFinanced)
    return matchesArea && matchesType
  })

  // --- KPI Calculations ---
  const activeProcesses = filteredProcesses.filter((p: any) => p.status !== 'Arquivado').length

  // --- Pipeline de Receita Futura ---
  const activeProcessesList = filteredProcesses.filter((p: any) => p.status !== 'Arquivado' && p.status !== 'Encerrado')
  const totalGrossValue = activeProcessesList.reduce((acc: number, p: any) => {
    const contract = data.contracts.find(c => c.processNumber === p.number)
    return acc + (Number(contract?.contractValue) || 0)
  }, 0)

  const successfulProcessesCount = data.processes.filter((p: any) => p.status === 'Êxito').length
  const totalProcessesCount = data.processes.length
  const currentWinRate = totalProcessesCount > 0 ? (successfulProcessesCount / totalProcessesCount) * 100 : 0
  const estimatedFutureRevenue = totalGrossValue * (currentWinRate / 100)

  // Top 3 areas
  const areaRevenue: Record<string, number> = {}
  activeProcessesList.forEach((p: any) => {
    const contract = data.contracts.find(c => c.processNumber === p.number)
    const area = contract?.lawArea || 'Não Informado'
    areaRevenue[area] = (areaRevenue[area] || 0) + (Number(contract?.contractValue) || 0)
  })
  const topAreas = Object.entries(areaRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, value]) => ({ 
      name, 
      percent: totalGrossValue > 0 ? (value / totalGrossValue) * 100 : 0 
    }))

  // 4. Law Area Distribution
  const areaCounts: Record<string, number> = {}
  filteredContracts.forEach((c: any) => {
    const area = c.lawArea || 'Não Informado'
    areaCounts[area] = (areaCounts[area] || 0) + 1
  })
  
  // Monthly Goal from Settings
  const monthlyGoal = settings.dashboard_goals?.monthly_revenue || 150000
  const currentMonthRevenue = data.transactions
    .filter((t: any) => {
      const today = new Date()
      const tDate = new Date(t.date)
      return tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear()
    })
    .reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0)
  
  const goalProgress = Math.min((currentMonthRevenue / monthlyGoal) * 100, 100)

  // INSS Success Rate
  const inssContracts = filteredContracts.filter(c => c.inssProtocol)
  const inssSuccessCount = inssContracts.filter(c => c.inssDeferred).length
  const inssFailCount = inssContracts.filter(c => !c.inssDeferred && c.inssProtocol).length
  const inssSuccessRate = inssContracts.length > 0 ? (inssSuccessCount / inssContracts.length) * 100 : 0

  const inssSuccessData = [
    { name: 'Deferidos', value: inssSuccessCount },
    { name: 'Indeferidos', value: inssFailCount },
  ].filter(d => d.value > 0)

  // Operational Bottlenecks (Stuck in Protocol)
  const stuckInProtocol = filteredContracts.filter(c => c.inssProtocol && !c.inssDeferred && !c.processNumber).length
  const stuckInJudicial = filteredContracts.filter(c => !c.inssProtocol && c.processNumber && c.status === 'Aberto').length

  // Profitability by Area
  const profitabilityByArea = Object.entries(areaCounts).map(([name, count]) => {
    const value = filteredContracts
      .filter(c => c.lawArea === name)
      .reduce((acc, c) => acc + Number(c.contractValue || 0), 0)
    return { name, value }
  }).sort((a, b) => b.value - a.value)

  const totalReceivable = data.installments
    .filter((t: any) => {
      const contract = data.contracts.find(c => c.id === t.contract_id)
      if (!contract) return false
      const matchesArea = filters.lawArea === 'all' || contract.lawArea === filters.lawArea
      const matchesType = filters.contractType === 'all' || 
        (filters.contractType === 'pro-bono' && contract.isProBono) ||
        (filters.contractType === 'financed' && contract.isFinanced) ||
        (filters.contractType === 'normal' && !contract.isProBono && !contract.isFinanced)
      return matchesArea && matchesType && ['Aberto', 'Parcial', 'Prorrogada', 'Atrasada'].includes(t.status)
    })
    .reduce((acc: number, t: any) => acc + (Number(t.amount) || 0) - (Number(t.amountPaid) || 0), 0)

  const totalReceived = data.transactions
    .filter((t: any) => {
      // Financial transactions don't always link directly to contracts in this schema, 
      // but we can try to infer or just show global if no link exists.
      return true 
    })
    .reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0)
  
  const proBonoContracts = filteredContracts.filter((c: any) => c.isProBono)
  const proBonoCount = proBonoContracts.length
  const socialImpactValue = proBonoContracts.reduce((acc: number, c: any) => acc + Number(c.contractValue || 0), 0)

  const financedContracts = filteredContracts.filter((c: any) => c.isFinanced)
  const financedCount = financedContracts.length
  const financedBalance = financedContracts.reduce((acc: number, c: any) => acc + Number(c.amountReceivable || 0), 0)

  const averageTicket = filteredContracts.length > 0 
    ? filteredContracts.reduce((acc: number, c: any) => acc + Number(c.contractValue || 0), 0) / filteredContracts.length 
    : 0

  // Operational Efficiency
  const winRate = filteredProcesses.length > 0
    ? (filteredProcesses.filter(p => {
        const s = p.status?.toLowerCase() || ''
        return s.includes('favorável') || 
               s.includes('concluído') || 
               s.includes('procedente') || 
               s.includes('acordo') ||
               s.includes('deferido') ||
               s.includes('ganho') ||
               s.includes('êxito')
      }).length / filteredProcesses.length) * 100
    : 0

  const leadTime = filteredProcesses
    .filter(p => p.status === 'Arquivado' && p.created_at && p.last_update)
    .reduce((acc, p) => {
      const start = new Date(p.created_at).getTime()
      const end = new Date(p.last_update).getTime()
      return acc + (end - start) / (1000 * 60 * 60 * 24)
    }, 0) / (filteredProcesses.filter(p => p.status === 'Arquivado').length || 1)

  const overdueInstallmentsRaw = data.installments.filter((i: any) => {
    const contract = data.contracts.find(c => c.id === i.contract_id)
    if (!contract) return false
    const matchesArea = filters.lawArea === 'all' || contract.lawArea === filters.lawArea
    const matchesType = filters.contractType === 'all' || 
      (filters.contractType === 'pro-bono' && contract.isProBono) ||
      (filters.contractType === 'financed' && contract.isFinanced) ||
      (filters.contractType === 'normal' && !contract.isProBono && !contract.isFinanced)
    
    if (!matchesArea || !matchesType) return false

    const dueDate = new Date(i.dueDate)
    const dueDateLocal = new Date(dueDate.getTime() + dueDate.getTimezoneOffset() * 60000)
    dueDateLocal.setHours(0,0,0,0)
    const today = new Date()
    today.setHours(0,0,0,0)
    
    return (i.status === 'Atrasada') || (['Aberto', 'Parcial', 'Prorrogada'].includes(i.status) && dueDateLocal < today)
  })

  const overdueTotal = overdueInstallmentsRaw.reduce((acc: number, i: any) => acc + (Number(i.amount) || 0) - (Number(i.amountPaid) || 0), 0)
  const defaultRate = totalReceivable > 0 ? (overdueTotal / totalReceivable) * 100 : 0

  // --- Charts Data ---

  // 1. Mix de Contratos (Donut)
  const mixData = [
    { name: 'Normal', value: filteredContracts.filter(c => !c.isProBono && !c.isFinanced).length },
    { name: 'Pro Bono', value: filteredContracts.filter(c => c.isProBono).length },
    { name: 'Financiado', value: filteredContracts.filter(c => c.isFinanced).length },
  ].filter(d => d.value > 0)

  // 2. Cash Flow Projection (Next 12 Months)
  const next12Months = [...Array(12)].map((_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() + i)
    return d
  })

  const cashFlowProjectionData = next12Months.map(date => {
    const monthStr = date.toLocaleString('pt-BR', { month: 'short' })
    const monthIso = date.toISOString().slice(0, 7)

    const recurring = data.installments
      .filter((i: any) => {
        const contract = data.contracts.find(c => c.id === i.contract_id)
        return i.dueDate?.startsWith(monthIso) && contract && !contract.isProBono
      })
      .reduce((acc: number, i: any) => acc + (Number(i.amount) || 0), 0)

    // Assuming success fees are estimated or tracked separately, here we just mock or use a specific category
    const successFees = data.contracts
      .filter((c: any) => c.status === 'Aberto' && c.lawArea === 'Previdenciário') // Example logic
      .length * 500 // Mock value for projection

    return { 
      name: monthStr.charAt(0).toUpperCase() + monthStr.slice(1), 
      recorrente: recurring,
      exito: successFees 
    }
  })

  // 3. Revenue Evolution (Filtered)
  const last6Months = [...Array(6)].map((_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return d
  }).reverse()

  const revenueChartData = last6Months.map(date => {
    const monthStr = date.toLocaleString('pt-BR', { month: 'short' })
    const monthIso = date.toISOString().slice(0, 7)

    const total = data.transactions
      .filter((t: any) => t.date && t.date.startsWith(monthIso))
      .reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0)

    return { name: monthStr.charAt(0).toUpperCase() + monthStr.slice(1), receita: total }
  })

  const areaChartData = Object.entries(areaCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // 5. Process Status Distribution
  const statusCounts: Record<string, number> = {}
  filteredProcesses.forEach((p: any) => {
    const status = p.status || 'Não Informado'
    statusCounts[status] = (statusCounts[status] || 0) + 1
  })
  const statusChartData = Object.entries(statusCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // 6. Installment Status Distribution
  const instStatusCounts: Record<string, number> = {}
  data.installments.forEach((i: any) => {
    const status = i.status || 'Aberto'
    instStatusCounts[status] = (instStatusCounts[status] || 0) + 1
  })
  const instStatusChartData = Object.entries(instStatusCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // 7. Churn Risk (Processes with no update in 30 days)
  const churnRiskProcesses = filteredProcesses.filter(p => {
    if (!p.last_update) return true // If no update, it's a risk
    const lastUpdate = new Date(p.last_update).getTime()
    const diff = (new Date().getTime() - lastUpdate) / (1000 * 60 * 60 * 24)
    return diff > 30 && p.status !== 'Arquivado'
  }).slice(0, 5)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdueList = overdueInstallmentsRaw.map((i: any) => {
    const contract = data.contracts.find((c: any) => c.id === i.contract_id)
    const client = data.clients.find((cl: any) => cl.id === contract?.client_id)
    return {
      ...i,
      clientName: client?.name || 'Cliente não identificado',
      contractId: contract?.id
    }
  }).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 5)

  const receivables7Days = getReceivablesForDays(7);
  const receivables15Days = getReceivablesForDays(15);
  const receivables30Days = getReceivablesForDays(30);

  function getReceivablesForDays(days: number) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    futureDate.setHours(23,59,59,999);

    return data.installments
      .filter((i: any) => {
        const contract = data.contracts.find(c => c.id === i.contract_id);
        if (!contract || contract.isProBono) return false;
        
        const [year, month, day] = i.dueDate.split('-').map(Number);
        const dueDateLocal = new Date(year, month - 1, day);
        dueDateLocal.setHours(0,0,0,0);

        return ['Aberto', 'Parcial', 'Prorrogada', 'Atrasada'].includes(i.status) && dueDateLocal >= today && dueDateLocal <= futureDate;
      })
      .reduce((acc: number, i: any) => acc + (Number(i.amount) || 0) - (Number(i.amountPaid) || 0), 0);
  }

  // Actionable Items
  const deadlinesToday = data.deadlines.filter((d: any) => {
    const deadlineDate = new Date(d.deadline_date);
    const today = new Date();
    return deadlineDate.toDateString() === today.toDateString();
  }).map((d: any) => ({
    id: d.id,
    title: d.process_number,
    subtitle: d.client_name || 'Sem cliente',
    actionLabel: 'Ver',
    onAction: () => window.location.href = `/processos`
  }));

  const overdueContracts = data.installments.filter((i: any) => {
    const dueDate = new Date(i.dueDate);
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    return dueDate >= today && dueDate <= nextWeek && (i.status === 'Aberto' || i.status === 'Atrasada');
  }).map((i: any) => {
    const contract = data.contracts.find((c: any) => c.id === i.contract_id);
    const client = data.clients.find((cl: any) => cl.id === contract?.client_id);
    return {
      id: i.id,
      title: client?.name || 'Cliente não identificado',
      subtitle: `Vencimento: ${new Date(i.dueDate).toLocaleDateString()}`,
      actionLabel: 'Cobrar',
      onAction: () => alert(`Cobrar cliente ${client?.name}`)
    };
  });

  const upcomingHearings = data.processes.filter((p: any) => p.type === 'Audiência' && new Date(p.deadline_date) >= new Date()).map((p: any) => ({
    id: p.id,
    title: p.number,
    subtitle: `Data: ${new Date(p.deadline_date).toLocaleDateString()}`,
    actionLabel: 'Ver',
    onAction: () => window.location.href = `/processos`
  }));

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
    'financial_transactions': 'Fluxo de Caixa'
  }

  const actionTranslations: Record<string, string> = {
    'INSERT': 'Inclusão',
    'UPDATE': 'Alteração',
    'DELETE': 'Exclusão'
  }

  const stats = [
    { label: 'Processos Ativos', value: activeProcesses.toString(), change: '+12% vs mês anterior', trend: 'up', icon: FileText, color: 'bg-indigo-500', show: user?.canAccessProcesses },
    { label: 'Ticket Médio', value: formatCurrency(averageTicket), change: 'Meta: R$ 5.000,00', trend: 'neutral', icon: DollarSign, color: 'bg-violet-500', show: user?.canAccessContracts },
    { label: 'Impacto Social', value: formatCurrency(socialImpactValue), change: `${proBonoCount} contratos`, trend: 'neutral', icon: Heart, color: 'bg-rose-500', show: user?.canAccessContracts },
    { label: 'Financiados', value: financedCount.toString(), change: `Saldo: ${formatCurrency(financedBalance)}`, trend: 'neutral', icon: TrendingUp, color: 'bg-blue-500', show: user?.canAccessContracts },
    { label: 'Taxa de Sucesso', value: `${winRate.toFixed(1)}%`, change: 'Meta: 65%', trend: winRate >= 65 ? 'up' : 'down', icon: CheckCircle2, color: 'bg-emerald-500', show: user?.canAccessIndicators },
    { label: 'Inadimplência', value: `${defaultRate.toFixed(1)}%`, change: 'Meta: < 5%', trend: defaultRate < 5 ? 'up' : 'down', icon: AlertOctagon, color: 'bg-amber-500', show: user?.canAccessContracts },
  ].filter(s => s.show !== false)

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {greeting}, {user?.name?.split(' ')[0] || 'Doutor(a)'}.
            </h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Visão em tempo real do seu escritório
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Filters */}
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="pl-3 text-slate-400">
                <Filter size={16} />
              </div>
              <select 
                className="bg-transparent border-none text-sm font-semibold text-slate-700 focus:ring-0 outline-none pr-8 cursor-pointer"
                value={filters.lawArea}
                onChange={(e) => setFilters({ ...filters, lawArea: e.target.value })}
              >
                <option value="all">Todas as Áreas</option>
                {Array.from(new Set(data.contracts.map((c: any) => c.lawArea).filter(Boolean))).sort().map(area => (
                  <option key={area as string} value={area as string}>{area as string}</option>
                ))}
              </select>
              <div className="w-px h-4 bg-slate-200 mx-1" />
              <select 
                className="bg-transparent border-none text-sm font-semibold text-slate-700 focus:ring-0 outline-none pr-8 cursor-pointer"
                value={filters.contractType}
                onChange={(e) => setFilters({ ...filters, contractType: e.target.value })}
              >
                <option value="all">Todos os Tipos</option>
                <option value="normal">Normal</option>
                <option value="pro-bono">Pro Bono</option>
                <option value="financed">Financiado</option>
              </select>
            </div>

            <button 
              onClick={generateRuleBasedInsight}
              disabled={isGeneratingInsight}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-2xl shadow-lg shadow-indigo-200 font-medium text-sm flex items-center gap-2 transition-all active:scale-95"
            >
              {isGeneratingInsight ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Gerar Insights
            </button>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800">
            <AlertTriangle className="text-amber-500 shrink-0" size={20} />
            <p className="text-sm">
              <strong>Supabase não configurado:</strong> Configure as variáveis de ambiente no painel do AI Studio.
            </p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Novo Cliente', icon: Users, href: '/clientes', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', show: user?.canAccessClients },
            { label: 'Novo Processo', icon: FileText, href: '/processos', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', show: user?.canAccessProcesses },
            { label: 'Lançar Receita', icon: DollarSign, href: '/contas-a-receber', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', show: user?.canAccessReceivables },
            { label: 'Nova Despesa', icon: TrendingDown, href: '/fluxo-caixa', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', show: user?.canAccessCashFlow },
            { label: 'Relatórios', icon: PieChartIcon, href: '/relatorios', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', show: user?.canAccessReports },
          ].filter(a => a.show !== false).map((action, i) => (
            <motion.a
              key={action.label}
              href={action.href}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-sm hover:shadow-md transition-all active:scale-95",
                "bg-white hover:bg-slate-50",
                action.border
              )}
            >
              <div className={cn("p-1.5 rounded-lg", action.bg, action.color)}>
                <action.icon size={16} />
              </div>
              <span className="text-sm font-semibold text-slate-700">{action.label}</span>
            </motion.a>
          ))}
        </div>

        {/* Actionable Insights */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <TodayFocusWidget />
          <LiquidityGapCard gap={totalReceivable - overdueTotal} isVisible={isVisible('dashboard_liquidity')} toggleVisibility={() => toggleVisibility('dashboard_liquidity')} />
          <StuckProcessesCard count={stuckInProtocol + stuckInJudicial} onAction={() => window.location.href = '/processos'} />
          <DefaultRiskCard riskAmount={overdueTotal} count={overdueInstallmentsRaw.length} onAction={() => window.location.href = '/contas-a-receber'} />
          <GPSDashboardCard />
        </div>

        {/* Task Kanban */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Fluxo de Compromissos</h2>
          <TaskKanban />
        </div>

        {/* Business Pulse */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Goal & Metrics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Monthly Goal Card */}
            {user?.canAccessContracts && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                  <Target size={180} />
                </div>
                
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Target className="text-indigo-600" size={20} />
                      Meta Mensal
                      <button 
                        onClick={() => toggleVisibility('dashboard_goal')}
                        className="text-slate-400 hover:text-slate-600 transition-colors ml-2"
                      >
                        {isVisible('dashboard_goal') ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">Progresso baseado em recebimentos reais</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-bold text-slate-900 tracking-tight">
                      {isVisible('dashboard_goal') ? `${goalProgress.toFixed(1)}%` : '•••%'}
                    </span>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">da meta de {formatCurrency(monthlyGoal, isVisible('dashboard_goal'))}</p>
                  </div>
                </div>

                <div className="relative h-6 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${goalProgress}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={cn(
                      "h-full transition-all duration-1000 relative",
                      goalProgress > 100 ? "bg-emerald-500" : goalProgress > 80 ? "bg-emerald-500" : goalProgress > 40 ? "bg-indigo-500" : "bg-amber-500"
                    )}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }} />
                  </motion.div>
                  {/* Markers */}
                  <div className="absolute inset-0 flex justify-between px-1">
                    <div className="w-0.5 h-full bg-white/50" style={{ left: '25%' }} />
                    <div className="w-0.5 h-full bg-white/50" style={{ left: '50%' }} />
                    <div className="w-0.5 h-full bg-white/50" style={{ left: '75%' }} />
                  </div>
                </div>

                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span>R$ 0</span>
                  <span>{formatCurrency(monthlyGoal * 0.5, isVisible('dashboard_goal'))}</span>
                  <span>{formatCurrency(monthlyGoal, isVisible('dashboard_goal'))}</span>
                </div>
              </motion.div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, i) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>
          </div>

          {/* Right Column: AI Insights */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden flex flex-col"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Sparkles size={150} />
            </div>
            
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                  <BrainCircuit size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wider uppercase text-indigo-200">Parecer Virtual</h3>
                  <p className="text-[10px] text-indigo-400 font-mono uppercase tracking-widest">System Analysis Active</p>
                </div>
              </div>
              <button 
                onClick={generateRuleBasedInsight}
                disabled={isGeneratingInsight}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all active:scale-95"
              >
                {isGeneratingInsight ? <Loader2 size={16} className="animate-spin text-indigo-300" /> : <RotateCcw size={16} className="text-indigo-300" />}
              </button>
            </div>

            <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar font-mono text-xs">
              {aiInsight ? (
                <div className="text-indigo-100 leading-relaxed whitespace-pre-wrap">
                  {aiInsight.split('\n').map((line, i) => (
                    <p key={i} className="mb-3 last:mb-0 border-l-2 border-indigo-500/30 pl-3">{line}</p>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-8 gap-4 opacity-50">
                  <Sparkles size={32} />
                  <p className="text-[10px] font-mono uppercase tracking-widest">Aguardando dados...</p>
                </div>
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              <span>Status: Online</span>
              <span className="flex items-center gap-1.5 text-emerald-500">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Feed
              </span>
            </div>
          </motion.div>
        </div>

        {/* Actionable Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">Pipeline de Receita Futura</h3>
                <button 
                  onClick={(e) => { e.preventDefault(); toggleVisibility('pipeline_revenue'); }} 
                  className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                  title={isVisible('pipeline_revenue') ? "Ocultar valor" : "Mostrar valor"}
                >
                  {isVisible('pipeline_revenue') ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <Target size={20} />
              </div>
            </div>

            <div className="flex-1 space-y-6">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Êxito Estimado ({currentWinRate.toFixed(1)}%)</p>
                <h4 className="text-3xl font-bold text-indigo-600 tracking-tight">
                  {formatCurrency(estimatedFutureRevenue, isVisible('pipeline_revenue'))}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  De um total bruto de <span className="font-bold">{formatCurrency(totalGrossValue, isVisible('pipeline_revenue'))}</span> em lide.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distribuição por Área</p>
                <div className="space-y-2">
                  {topAreas.length > 0 ? topAreas.map((area, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-700 truncate max-w-[150px]">{area.name}</span>
                        <span className="text-slate-500">{area.percent.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${area.percent}%` }}
                          transition={{ duration: 1, delay: 0.5 + (idx * 0.1) }}
                          className={cn("h-full rounded-full", idx === 0 ? "bg-indigo-500" : idx === 1 ? "bg-cyan-500" : "bg-violet-500")}
                        />
                      </div>
                    </div>
                  )) : (
                    <p className="text-[10px] text-slate-400 italic">Nenhum dado disponível</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 p-2 rounded-lg">
                <TrendingUp size={14} />
                <span>Patrimônio Jurídico Ativo</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottlenecks (Prioritized) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {user?.canAccessProcesses && (
            <motion.a 
              href="/processos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-rose-300 transition-colors"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                  <Zap size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Gargalos INSS</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <div>
                    <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Aguardando Impulso</p>
                    <h4 className="text-2xl font-bold text-rose-700">{stuckInProtocol}</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-rose-500 font-medium leading-tight">Contratos parados em<br/>&quot;Protocolo&quot; sem processo</p>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ação Recomendada</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Considere impetrar Mandado de Segurança para os protocolos com mais de 45 dias sem resposta.
                  </p>
                </div>
              </div>
            </motion.a>
          )}

          {user?.canAccessProcesses && (
            <motion.a 
              href="/processos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Scale size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Gargalos na Justiça</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Aguardando Andamento</p>
                    <h4 className="text-2xl font-bold text-indigo-700">{stuckInJudicial}</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-indigo-500 font-medium leading-tight">Contratos com processo<br/>aberto sem conclusão</p>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ação Recomendada</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Verifique os processos parados há mais de 30 dias na mesma fase.
                  </p>
                </div>
              </div>
            </motion.a>
          )}
        </div>

        {/* Deadline Radar */}
        {user?.canAccessProcesses && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Radar de Prazos</h3>
              <div className="flex gap-2">
                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 uppercase tracking-tighter">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" /> Crítico
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-[1fr,auto] gap-4 px-4 mb-2">
              <span className="font-serif italic text-[11px] uppercase tracking-widest opacity-50">Processo / Cliente</span>
              <span className="font-serif italic text-[11px] uppercase tracking-widest opacity-50 text-right">Prazo</span>
            </div>

            <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {data.deadlines.length === 0 && <p className="text-sm text-slate-500 px-4">Nenhum prazo pendente.</p>}
              {data.deadlines.slice(0, 10).sort((a: any, b: any) => a.days_remaining - b.days_remaining).map((d: any) => {
                const isCritical = d.days_remaining <= 1;
                const progress = Math.min(100, Math.max(0, (30 - d.days_remaining) / 30 * 100));
                
                return (
                  <div 
                    key={d.id} 
                    className={cn(
                      "group cursor-pointer p-4 rounded-xl border transition-all hover:shadow-md",
                      isCritical ? "bg-rose-50 border-rose-200 hover:border-rose-400" : "bg-white border-slate-100 hover:border-slate-300"
                    )}
                    onClick={() => window.location.href = `/processos/${d.process_id}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={cn("text-sm font-bold", isCritical ? "text-rose-900" : "text-slate-900")}>
                        {d.process_number}
                      </span>
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter",
                        isCritical ? "bg-rose-200 text-rose-800" : "bg-slate-100 text-slate-600"
                      )}>
                        {d.days_remaining} {d.days_remaining === 1 ? 'dia' : 'dias'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-1 truncate">{d.client_name}</p>
                    <p className="text-xs font-medium text-slate-700 mb-3 truncate">{d.description}</p>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full transition-all duration-500", isCritical ? "bg-rose-500" : "bg-indigo-500")} 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}





        {/* Charts Row 1: Revenue & Mix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Evolution */}
          {user?.canAccessContracts && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Evolução da Receita (Últimos 6 meses)</h3>
                  <button 
                    onClick={(e) => { e.preventDefault(); toggleVisibility('dashboard_revenue_evolution'); }} 
                    className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    title={isVisible('dashboard_revenue_evolution') ? "Ocultar valor" : "Mostrar valor"}
                  >
                    {isVisible('dashboard_revenue_evolution') ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Realizado</span>
                  </div>
                </div>
              </div>
              <div className={cn("h-[300px] w-full transition-all duration-300", !isVisible('dashboard_revenue_evolution') && "blur-sm pointer-events-none")}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(value) => `R$ ${value/1000}k`} />
                    <Tooltip 
                      cursor={{ stroke: '#10b981', strokeWidth: 1 }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number | undefined) => formatCurrency(value, isVisible('dashboard_revenue_evolution'))}
                    />
                    <Area type="monotone" dataKey="receita" name="Receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Mix de Contratos */}
          {user?.canAccessContracts && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-6">Composição de Carteira</h3>
              <div className="h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={mixData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {mixData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
                {mixData.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                    Sem dados
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Charts Row 2: Cash Flow & Profitability */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cash Flow Projection */}
          {user?.canAccessCashFlow && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Projeção de Fluxo de Caixa (12 Meses)</h3>
                  <button 
                    onClick={(e) => { e.preventDefault(); toggleVisibility('dashboard_cashflow_projection'); }} 
                    className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    title={isVisible('dashboard_cashflow_projection') ? "Ocultar valor" : "Mostrar valor"}
                  >
                    {isVisible('dashboard_cashflow_projection') ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>Recorrente</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Êxito Est.</span>
                  </div>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowProjectionData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$ ${value/1000}k`} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => formatCurrency(value, isVisible('dashboard_cashflow_projection'))}
                    />
                    <Bar dataKey="recorrente" name="Recorrente" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} barSize={30} />
                    <Bar dataKey="exito" name="Êxito Est." stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Profitability by Area */}
          {user?.canAccessContracts && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                    <BarChart3 size={20} />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Rentabilidade por Área</h3>
                    <button 
                      onClick={(e) => { e.preventDefault(); toggleVisibility('dashboard_profitability'); }} 
                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                      title={isVisible('dashboard_profitability') ? "Ocultar valor" : "Mostrar valor"}
                    >
                      {isVisible('dashboard_profitability') ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Volume financeiro total por área de atuação</p>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitabilityByArea} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                      width={100}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => formatCurrency(value, isVisible('dashboard_profitability'))}
                    />
                    <Bar dataKey="value" name="Rentabilidade" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24}>
                      {profitabilityByArea.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </div>

        {/* Charts Row 3: Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Law Area Distribution */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-6">Contratos por Área</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={areaChartData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" name="Contratos" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Process Status Distribution */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-6">Status dos Processos</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" name="Processos" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Installment Status Distribution */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-6">Status das Parcelas</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={instStatusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {instStatusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Charts Row 4: Efficiency & INSS Success */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Efficiency & Performance */}
          <div className="grid grid-cols-1 gap-6 lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Lead Time Médio</h3>
                  <p className="text-xs text-slate-400 mb-4">Tempo médio para encerramento</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-slate-900">{leadTime.toFixed(0)}</span>
                    <span className="text-lg font-medium text-slate-500 mb-1">dias</span>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-500">Meta do Escritório</span>
                    <span className="text-emerald-600">365 dias</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-1000" 
                      style={{ width: `${Math.min((leadTime / 365) * 100, 100)}%` }} 
                    />
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Taxa de Sucesso</h3>
                  <p className="text-xs text-slate-400 mb-4">Processos com êxito</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-emerald-600">{winRate.toFixed(1)}</span>
                    <span className="text-lg font-medium text-emerald-500 mb-1">%</span>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-500">Média do Mercado</span>
                    <span className="text-slate-400">65%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-1000" 
                      style={{ width: `${winRate}%` }} 
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* INSS Success Rate */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Taxa de Êxito INSS</h3>
              <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                {inssSuccessRate.toFixed(1)}%
              </div>
            </div>
            <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={inssSuccessData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f43f5e" />
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-900">{inssSuccessCount}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Deferidos</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* AI Insights & Risk Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Insight Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-2xl border border-indigo-500 shadow-xl lg:col-span-2 text-white relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Sparkles size={120} />
            </div>
            
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg">
                  <BrainCircuit size={20} />
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">Parecer Estratégico</h3>
                  <button 
                    onClick={(e) => { e.preventDefault(); toggleVisibility('dashboard_insight'); }} 
                    className="p-1 text-white/50 hover:text-white transition-colors"
                    title={isVisible('dashboard_insight') ? "Ocultar valor" : "Mostrar valor"}
                  >
                    {isVisible('dashboard_insight') ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              </div>
              <button 
                onClick={generateRuleBasedInsight}
                disabled={isGeneratingInsight}
                className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg backdrop-blur-md transition-all flex items-center gap-2"
              >
                {isGeneratingInsight ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw size={14} />}
                Recalcular
              </button>
            </div>

            <div className="relative z-10 min-h-[100px]">
              {aiInsight ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-indigo-50 leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  <p className="text-sm font-medium text-indigo-100">Gerando insights estratégicos...</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Churn Risk Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                  <ShieldAlert size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Risco de Abandono</h3>
              </div>
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-lg">
                {churnRiskProcesses.length} Críticos
              </span>
            </div>

            <div className="space-y-3">
              {churnRiskProcesses.length > 0 ? (
                churnRiskProcesses.map((p: any) => (
                  <div key={p.id} className="p-3 rounded-xl border border-slate-100 hover:border-rose-200 transition-colors group">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-slate-900 truncate flex-1">{p.number}</p>
                      <span className="text-[10px] font-bold text-rose-50 uppercase">Sem Movimentação</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 truncate">{p.client}</p>
                      <p className="text-[10px] text-slate-400">
                        {p.last_update ? `${Math.floor((new Date().getTime() - new Date(p.last_update).getTime()) / (1000 * 60 * 60 * 24))} dias` : 'Nunca'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                  <p className="text-sm font-medium">Todos os processos ativos</p>
                </div>
              )}
            </div>
            
            {churnRiskProcesses.length > 0 && (
              <button className="w-full mt-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                Ver todos os riscos
              </button>
            )}
          </motion.div>
        </div>

        {/* Lists Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Deadlines */}
          
          {/* Overdue Installments */}
          {user?.canAccessContracts && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Parcelas em Atraso</h3>
                  <button 
                    onClick={(e) => { e.preventDefault(); toggleVisibility('dashboard_overdue'); }} 
                    className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    title={isVisible('dashboard_overdue') ? "Ocultar valor" : "Mostrar valor"}
                  >
                    {isVisible('dashboard_overdue') ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <div className="p-2 bg-rose-50 rounded-lg text-rose-500">
                  <AlertOctagon size={20} />
                </div>
              </div>
              
              <div className="flex-1 space-y-0">
                <div className="grid grid-cols-[1fr,auto] gap-4 px-4 mb-2">
                  <span className="font-serif italic text-[11px] uppercase tracking-widest opacity-50">Cliente / Parcela</span>
                  <span className="font-serif italic text-[11px] uppercase tracking-widest opacity-50 text-right">Valor</span>
                </div>
                {overdueList.length > 0 ? (
                  overdueList.map((i: any) => (
                    <div key={i.id} className="grid grid-cols-[1fr,auto] gap-4 items-center px-4 py-3 border-b border-rose-100 hover:bg-rose-900 hover:text-rose-50 transition-colors cursor-pointer rounded-lg">
                      <div>
                        <p className="text-sm font-semibold">{i.clientName}</p>
                        <p className="text-xs opacity-70">Parcela {i.installmentNumber} • Venceu em {formatDate(i.dueDate)}</p>
                      </div>
                      <div className="text-sm font-bold font-mono">
                        {formatCurrency((Number(i.amount) || 0) - (Number(i.amountPaid) || 0), isVisible('dashboard_overdue'))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                    <CheckCircle2 size={32} className="text-emerald-400" />
                    <p className="text-sm font-medium">Nenhuma parcela em atraso</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Upcoming Payments */}
          {user?.canAccessContracts && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Recebimentos Futuros</h3>
                  <button 
                    onClick={() => toggleVisibility('dashboard_upcoming')} 
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {isVisible('dashboard_upcoming') ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-500">
                  <DollarSign size={20} />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Próximos 7 dias:</span>
                  <span className="text-sm font-bold font-mono">{formatCurrency(receivables7Days, isVisible('dashboard_upcoming'))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Próximos 15 dias:</span>
                  <span className="text-sm font-bold font-mono">{formatCurrency(receivables15Days, isVisible('dashboard_upcoming'))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Próximos 30 dias:</span>
                  <span className="text-sm font-bold font-mono">{formatCurrency(receivables30Days, isVisible('dashboard_upcoming'))}</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* New Row: Clients & Finance Summary */}
        
        {/* Recent Activities Row */}
        {user?.canAccessAudit && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Atividades Recentes</h3>
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500">
                <Clock size={20} />
              </div>
            </div>

            <div className="space-y-4">
              {data.auditLogs.length > 0 ? (
                data.auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      log.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700' :
                      log.action === 'UPDATE' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {log.action === 'INSERT' && <CheckCircle2 size={16} />}
                      {log.action === 'UPDATE' && <TrendingUp size={16} />}
                      {log.action === 'DELETE' && <AlertOctagon size={16} />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        <span className="font-bold">{log.performer?.name || 'Sistema'}</span> {actionTranslations[log.action]?.toLowerCase()} em <span className="font-bold">{tableTranslations[log.table_name] || log.table_name}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ID do registro: #{log.record_id} • {new Date(log.performed_at).toLocaleString('pt-BR')}
                      </p>
                    </div>

                    <div className="text-xs font-medium text-slate-400 whitespace-nowrap">
                      {new Date(log.performed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                  <Database size={32} className="text-slate-200" />
                  <p className="text-sm font-medium">Nenhuma atividade registrada</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
      <GlobalActionCenter />
    </DashboardLayout>
  )
}

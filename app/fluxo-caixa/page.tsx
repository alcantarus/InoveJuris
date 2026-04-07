'use client'

import React, { useState, useEffect, useRef } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  History,
  CreditCard,
  PieChart as PieChartIcon,
  AlertTriangle,
  ArrowRightLeft,
  Filter,
  Eye,
  EyeOff,
  ChevronRight
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
import { formatDate, cn, formatCurrency, getTodayBR } from '@/lib/utils'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import Link from 'next/link'
import { AutoResizeText } from '@/components/ui/AutoResizeText'

const COLORS = ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const StatCard = ({ stat, isVisible, toggleVisibility }: { stat: any, isVisible: (key: string) => boolean, toggleVisibility: (key: string) => void }) => {
  const textContainerRef = useRef<HTMLDivElement>(null);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 relative overflow-hidden"
    >
      {/* Decorative Background Element */}
      <div className={cn(
        "absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-[0.03] transition-transform duration-500 group-hover:scale-150",
        stat.color
      )} />

      <div className="flex items-center justify-between relative z-10">
        <div className={cn(
          "p-3.5 rounded-2xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110",
          stat.color
        )}>
          <stat.icon size={22} />
        </div>
        <div className="flex flex-col items-end">
          {stat.trend === 'up' && (
            <div className="flex items-center gap-1 text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold">
              <ArrowUpRight size={14} />
              <span>Alta</span>
            </div>
          )}
          {stat.trend === 'down' && (
            <div className="flex items-center gap-1 text-rose-500 bg-rose-50 px-2 py-1 rounded-lg text-xs font-bold">
              <ArrowDownRight size={14} />
              <span>Baixa</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 relative z-10">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
          <button 
            onClick={(e) => { e.preventDefault(); toggleVisibility('cashflow_stat_' + stat.label); }} 
            className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title={isVisible('cashflow_stat_' + stat.label) ? "Ocultar valor" : "Mostrar valor"}
          >
            {isVisible('cashflow_stat_' + stat.label) ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
        <div className="text-3xl font-black text-slate-900 mt-2 tracking-tight overflow-hidden whitespace-nowrap" ref={textContainerRef}>
          <AutoResizeText 
            text={formatCurrency(stat.value, isVisible('cashflow_stat_' + stat.label))}
            className="text-3xl font-black text-slate-900 tracking-tight"
            containerRef={textContainerRef}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default function FluxoCaixaPage() {
  const { isVisible, toggleVisibility } = usePrivacy()
  const [mounted, setMounted] = useState(false)
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all')
  const [data, setData] = useState({
    accounts: [] as any[],
    transactions: [] as any[],
    categories: [] as any[],
    installments: [] as any[]
  })

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured || !user) {
        setMounted(true)
        setLoading(false)
        return
      }

      try {
        const [accountsRes, transactionsRes, categoriesRes, installmentsRes] = await Promise.all([
          supabase.from('bank_accounts').select('*').eq('organization_id', user?.organizationId),
          supabase.from('financial_transactions').select('*, bank_accounts!account_id(name), financial_categories(name)').eq('organization_id', user?.organizationId).order('date', { ascending: false }).limit(100),
          supabase.from('financial_categories').select('*').eq('organization_id', user?.organizationId),
          supabase.from('installments').select('*').eq('organization_id', user?.organizationId).in('status', ['Aberto', 'Atrasada', 'Prorrogada'])
        ])

        setData({
          accounts: accountsRes.data || [],
          transactions: transactionsRes.data || [],
          categories: categoriesRes.data || [],
          installments: installmentsRes.data || []
        })
      } catch (error) {
        console.error('Error fetching cash flow data:', error)
      } finally {
        setLoading(false)
        setMounted(true)
      }
    }

    fetchData()
  }, [user])

  if (!mounted) return null

  const totalBalance = data.accounts.reduce((acc, curr) => acc + Number(curr.current_balance || 0), 0)
  
  const todayDate = getTodayBR()
  const startOfMonth = todayDate.substring(0, 8) + '01'
  
  const monthlyIncome = data.transactions
    .filter(t => t.type === 'income' && t.date >= startOfMonth)
    .reduce((acc, curr) => acc + Number(curr.amount), 0)
    
  const monthlyExpense = data.transactions
    .filter(t => t.type === 'expense' && t.date >= startOfMonth)
    .reduce((acc, curr) => acc + Number(curr.amount), 0)

  const receitasPrevistas = data.installments
    .filter(i => i.type === 'income')
    .reduce((acc, i) => acc + (Number(i.amount) - Number(i.amountPaid)), 0)

  const despesasPrevistas = data.installments
    .filter(i => i.type === 'expense')
    .reduce((acc, i) => acc + (Number(i.amount) - Number(i.amountPaid)), 0)

  const maiorSaida = data.transactions
    .filter(t => t.type === 'expense')
    .reduce((max, t) => Number(t.amount) > max ? Number(t.amount) : max, 0)

  // Chart Data: Daily Cash Flow (Last 30 days)
  const last30Days = [...Array(30)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    // Use toLocaleDateString with America/Sao_Paulo to get correct date for each of the last 30 days
    return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  }).reverse()

  const dailyChartData = last30Days.map(date => {
    const income = data.transactions
      .filter(t => t.type === 'income' && t.date === date && (selectedAccountId === 'all' || t.account_id === selectedAccountId))
      .reduce((acc, curr) => acc + Number(curr.amount), 0)
    const expense = data.transactions
      .filter(t => t.type === 'expense' && t.date === date && (selectedAccountId === 'all' || t.account_id === selectedAccountId))
      .reduce((acc, curr) => acc + Number(curr.amount), 0)
    return {
      name: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      Entradas: income,
      Saídas: expense
    }
  })

  const stats = [
    { label: 'Saldo Total', value: totalBalance, icon: Wallet, color: 'bg-indigo-500', trend: 'neutral' },
    { label: 'Entradas (Mês)', value: monthlyIncome, icon: TrendingUp, color: 'bg-emerald-500', trend: 'up' },
    { label: 'Saídas (Mês)', value: monthlyExpense, icon: TrendingDown, color: 'bg-rose-500', trend: 'down' },
    { label: 'Receitas Previstas', value: receitasPrevistas, icon: ArrowUpRight, color: 'bg-sky-500', trend: 'up' },
    { label: 'Saídas Previstas', value: despesasPrevistas, icon: ArrowDownRight, color: 'bg-orange-500', trend: 'down' },
    { label: 'Maior Saída', value: maiorSaida, icon: AlertTriangle, color: 'bg-rose-600', trend: 'neutral' },
    { label: 'Resultado Líquido', value: monthlyIncome - monthlyExpense, icon: ArrowRightLeft, color: 'bg-amber-500', trend: monthlyIncome - monthlyExpense >= 0 ? 'up' : 'down' },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-10 pb-10">
        {/* Header Section */}
        <ModuleHeader
          icon={Wallet}
          title="Fluxo de Caixa"
          description="Gestão inteligente de recursos, acompanhamento de receitas e controle rigoroso de despesas."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Link 
            href="/fluxo-caixa/contas"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
          >
            <CreditCard size={18} className="text-slate-400" />
            Contas
          </Link>
          <Link 
            href="/fluxo-caixa/categorias"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
          >
            <History size={18} className="text-slate-400" />
            Categorias
          </Link>
          <Link 
            href="/fluxo-caixa/movimentacoes"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus size={20} />
            Nova Movimentação
          </Link>
        </div>

        {!isSupabaseConfigured && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-4 text-amber-800 shadow-sm"
          >
            <div className="bg-amber-100 p-2 rounded-xl">
              <AlertTriangle className="text-amber-600" size={20} />
            </div>
            <p className="text-sm font-medium">
              <strong>Configuração Necessária:</strong> As tabelas financeiras ainda não foram detectadas no Supabase.
            </p>
          </motion.div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <StatCard key={stat.label} stat={stat} isVisible={isVisible} toggleVisibility={toggleVisibility} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Daily Flow Chart */}
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Fluxo Diário</h3>
                <p className="text-sm text-slate-400 font-medium">Análise de movimentações dos últimos 30 dias</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-500">Entradas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-xs font-bold text-slate-500">Saídas</span>
                </div>
              </div>
            </div>
            
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                    tickFormatter={(value) => `R$ ${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9', radius: 8 }}
                    contentStyle={{ 
                      borderRadius: '20px', 
                      border: 'none', 
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                      padding: '16px'
                    }}
                    itemStyle={{ fontWeight: 'bold', fontSize: '13px' }}
                    labelStyle={{ marginBottom: '8px', color: '#64748b', fontWeight: 'bold' }}
                    formatter={(value: any) => [formatCurrency(value, isVisible('cashflow_chart')), '']}
                  />
                  <Bar dataKey="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} barSize={12} />
                  <Bar dataKey="Saídas" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Accounts Summary */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Minhas Contas</h3>
                  <button 
                    onClick={(e) => { e.preventDefault(); toggleVisibility('cashflow_accounts'); }} 
                    className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    title={isVisible('cashflow_accounts') ? "Ocultar valor" : "Mostrar valor"}
                  >
                    {isVisible('cashflow_accounts') ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <p className="text-sm text-slate-400 font-medium">Saldos atuais por instituição</p>
              </div>
              <Link href="/fluxo-caixa/contas" className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                <ChevronRight size={20} />
              </Link>
            </div>
            
            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
              {data.accounts.length > 0 ? (
                data.accounts.map((account, idx) => (
                  <motion.button 
                    key={account.id} 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => setSelectedAccountId(selectedAccountId === account.id ? 'all' : account.id)}
                    className={cn(
                      "w-full text-left p-5 rounded-3xl border transition-all duration-300 group relative overflow-hidden",
                      selectedAccountId === account.id 
                        ? "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                        : "border-slate-50 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-md"
                    )}
                  >
                    {/* Decorative Circle */}
                    <div className={cn(
                      "absolute -right-6 -bottom-6 w-20 h-20 rounded-full opacity-[0.05]",
                      selectedAccountId === account.id ? "bg-white" : "bg-indigo-600"
                    )} />

                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-xl transition-colors",
                          selectedAccountId === account.id ? "bg-white/20 text-white" : "bg-white text-indigo-600 shadow-sm"
                        )}>
                          <CreditCard size={18} />
                        </div>
                        <span className={cn(
                          "font-bold tracking-tight",
                          selectedAccountId === account.id ? "text-white" : "text-slate-900"
                        )}>{account.name}</span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md",
                        selectedAccountId === account.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                      )}>{account.type}</span>
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={cn(
                          "text-xs font-bold uppercase tracking-widest",
                          selectedAccountId === account.id ? "text-white/60" : "text-slate-400"
                        )}>Saldo Disponível</p>
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleVisibility('cashflow_account_' + account.id); }} 
                          className={cn(
                            "p-1 rounded-md transition-all",
                            selectedAccountId === account.id ? "text-white/60 hover:text-white hover:bg-white/10" : "text-slate-300 hover:text-indigo-600 hover:bg-indigo-50"
                          )}
                        >
                          {isVisible('cashflow_account_' + account.id) ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                      </div>
                      <p className={cn(
                        "text-2xl font-black tracking-tight",
                        selectedAccountId === account.id ? "text-white" : "text-slate-900"
                      )}>
                        {formatCurrency(account.current_balance, isVisible('cashflow_accounts') && isVisible('cashflow_account_' + account.id))}
                      </p>
                    </div>

                    <div className={cn(
                      "mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-all",
                      selectedAccountId === account.id ? "text-white/80" : "text-indigo-600 opacity-0 group-hover:opacity-100"
                    )}>
                      {selectedAccountId === account.id ? 'Filtrando por esta conta' : 'Clique para filtrar'}
                      <ArrowRightLeft size={10} />
                    </div>
                  </motion.button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Wallet size={32} />
                  </div>
                  <p className="text-sm font-bold">Nenhuma conta encontrada</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Transactions / Bank Statement */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                  <History size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {selectedAccountId === 'all' ? 'Extrato Geral' : `Extrato: ${data.accounts.find(a => a.id === selectedAccountId)?.name}`}
                </h3>
                <button 
                  onClick={(e) => { e.preventDefault(); toggleVisibility('cashflow_transactions'); }} 
                  className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  title={isVisible('cashflow_transactions') ? "Ocultar valor" : "Mostrar valor"}
                >
                  {isVisible('cashflow_transactions') ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              <p className="text-sm text-slate-400 font-medium mt-2">
                {selectedAccountId === 'all' 
                  ? 'Visão consolidada de todas as suas movimentações financeiras' 
                  : `Exibindo apenas movimentações da conta ${data.accounts.find(a => a.id === selectedAccountId)?.name}`}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Filter size={14} />
                </div>
                <select 
                  className="pl-9 pr-10 py-2.5 text-sm font-bold text-slate-700 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  <option value="all">Todas as Contas</option>
                  {data.accounts.map(account => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </div>
              <Link 
                href="/fluxo-caixa/movimentacoes" 
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-2xl font-bold text-sm hover:bg-indigo-100 transition-all"
              >
                Ver Tudo
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-50">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Data</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Descrição</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Categoria</th>
                  {selectedAccountId === 'all' && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Conta</th>}
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.transactions
                  .filter(t => selectedAccountId === 'all' || t.account_id === selectedAccountId)
                  .slice(0, 15)
                  .map((transaction, idx) => (
                  <motion.tr 
                    key={transaction.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="group hover:bg-slate-50/50 transition-all duration-200"
                  >
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{formatDate(transaction.date).split('/')[0]}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(transaction.date).split('/').slice(1).join('/')}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                          transaction.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                          {transaction.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                        </div>
                        <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{transaction.description}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                        {transaction.financial_categories?.name || 'Sem categoria'}
                      </span>
                    </td>
                    {selectedAccountId === 'all' && (
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-slate-300" />
                          <span className="text-xs font-bold text-slate-500">{transaction.bank_accounts?.name}</span>
                        </div>
                      </td>
                    )}
                    <td className={cn(
                      "px-8 py-5 text-right text-base font-black tracking-tight",
                      transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                    )}>
                      {transaction.type === 'expense' ? '-' : '+'}
                      {formatCurrency(transaction.amount, isVisible('cashflow_transactions'))}
                    </td>
                  </motion.tr>
                ))}
                {(data.transactions.filter(t => selectedAccountId === 'all' || t.account_id === selectedAccountId).length === 0) && (
                  <tr>
                    <td colSpan={selectedAccountId === 'all' ? 5 : 4} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-300">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                          <History size={40} />
                        </div>
                        <p className="text-base font-bold">Nenhuma movimentação registrada</p>
                        <p className="text-sm font-medium mt-1">Comece adicionando uma nova entrada ou saída.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex items-center justify-center">
            <Link 
              href="/fluxo-caixa/movimentacoes" 
              className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] hover:text-indigo-600 transition-all flex items-center gap-2"
            >
              Ver Histórico Completo de Transações
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
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
  ResponsiveContainer
} from 'recharts'
import { motion } from 'motion/react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { formatDate, cn, formatCurrency, getTodayBR } from '@/lib/utils'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import Link from 'next/link'
import { AutoResizeText } from '@/components/ui/AutoResizeText'

const StatCard = ({ stat, isVisible, toggleVisibility }: { stat: any, isVisible: (key: string) => boolean, toggleVisibility: (key: string) => void }) => {
  const textContainerRef = useRef<HTMLDivElement>(null);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-50 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-500" />
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={cn("p-3 rounded-2xl shadow-sm", stat.bg, stat.color)}>
          <stat.icon size={22} />
        </div>
        <div className="flex items-center gap-1">
          {stat.privacyKey && (
            <button 
              onClick={(e) => { e.preventDefault(); toggleVisibility(stat.privacyKey); }} 
              className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              title={isVisible(stat.privacyKey) ? "Ocultar valor" : "Mostrar valor"}
            >
              {isVisible(stat.privacyKey) ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          )}
          <span className={cn(
            "text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1",
            stat.badgeBg, stat.badgeColor
          )}>
            {stat.badge}
          </span>
        </div>
      </div>
      <div className="relative z-10" ref={textContainerRef}>
        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.title}</p>
        <div className="text-2xl font-black text-slate-900 tracking-tight">
          <AutoResizeText text={formatCurrency(stat.value, stat.privacyKey ? isVisible(stat.privacyKey) : true)} containerRef={textContainerRef} />
        </div>
        <p className="text-xs font-medium text-slate-400 mt-2">{stat.subtitle}</p>
      </div>
    </motion.div>
  )
}

export default function FluxoCaixaPage() {
  const { isVisible, toggleVisibility } = usePrivacy()
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all')
  const [showZeroBalanceAccounts, setShowZeroBalanceAccounts] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    totalBalance: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    result: 0,
    accounts: [] as any[],
    transactions: [] as any[],
    chartData: [] as any[]
  })

  useEffect(() => {
    setMounted(true)
    fetchData()
  }, [])

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // 1. Fetch Accounts
      const { data: accountsData, error: accError } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('name')

      if (accError) throw accError

      // 2. Fetch Transactions
      const { data: txData, error: txError } = await supabase
        .from('financial_transactions')
        .select('*, bank_accounts(name), financial_categories(name)')
        .order('date', { ascending: false })
        .limit(50)

      if (txError) throw txError

      // 3. Calculate summary metrics
      const accounts = accountsData || []
      const transactions = txData || []

      const totalBalance = accounts.reduce((acc: number, curr: any) => acc + Number(curr.current_balance || 0), 0)

      const now = new Date()
      const currentMonth = now.toISOString().slice(0, 7) // YYYY-MM

      let monthlyIncome = 0
      let monthlyExpense = 0

      transactions.forEach((t: any) => {
        if (t.date && t.date.startsWith(currentMonth)) {
          if (t.type === 'income') monthlyIncome += Number(t.amount || 0)
          if (t.type === 'expense') monthlyExpense += Number(t.amount || 0)
        }
      })

      const result = monthlyIncome - monthlyExpense

      // Generate chart data for last 6 months or daily
      const chartMap: { [key: string]: { income: number; expense: number } } = {}
      transactions.forEach((t: any) => {
        if (!t.date) return
        const monthKey = t.date.slice(0, 7)
        if (!chartMap[monthKey]) {
          chartMap[monthKey] = { income: 0, expense: 0 }
        }
        if (t.type === 'income') chartMap[monthKey].income += Number(t.amount || 0)
        if (t.type === 'expense') chartMap[monthKey].expense += Number(t.amount || 0)
      })

      const chartData = Object.keys(chartMap).sort().slice(-6).map(m => ({
        month: m.split('-').reverse().join('/'),
        Entradas: chartMap[m].income,
        Saídas: chartMap[m].expense
      }))

      setData({
        totalBalance,
        monthlyIncome,
        monthlyExpense,
        result,
        accounts,
        transactions,
        chartData
      })
    } catch (err) {
      console.error('Error fetching cash flow data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  const stats = [
    {
      title: 'Saldo Consolidado',
      value: data.totalBalance,
      subtitle: `${data.accounts.length} contas cadastradas`,
      icon: Wallet,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      badge: data.totalBalance >= 0 ? 'Positivo' : 'Negativo',
      badgeColor: data.totalBalance >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50',
      privacyKey: 'cashflow_total'
    },
    {
      title: 'Entradas do Mês',
      value: data.monthlyIncome,
      subtitle: 'Recebimentos confirmados',
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      badge: '+ Mês Atual',
      badgeColor: 'text-emerald-700 bg-emerald-50',
      privacyKey: 'cashflow_income'
    },
    {
      title: 'Saídas do Mês',
      value: data.monthlyExpense,
      subtitle: 'Despesas e pagamentos',
      icon: TrendingDown,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      badge: '- Mês Atual',
      badgeColor: 'text-rose-700 bg-rose-50',
      privacyKey: 'cashflow_expense'
    },
    {
      title: 'Resultado Líquido',
      value: data.result,
      subtitle: 'Balanço do período',
      icon: ArrowRightLeft,
      color: data.result >= 0 ? 'text-indigo-600' : 'text-amber-600',
      bg: data.result >= 0 ? 'bg-indigo-50' : 'bg-amber-50',
      badge: data.result >= 0 ? 'Superávit' : 'Déficit',
      badgeColor: data.result >= 0 ? 'text-indigo-700 bg-indigo-50' : 'text-amber-700 bg-amber-50',
      privacyKey: 'cashflow_result'
    }
  ]

  return (
    <DashboardLayout>
      <div className="space-y-10 pb-16">
        <ModuleHeader 
          title="Fluxo de Caixa" 
          description="Painel de gestão financeira ágil, contas integradas e extrato consolidado."
          action={
            <div className="flex items-center gap-3">
              <Link 
                href="/fluxo-caixa/movimentacoes" 
                className="inline-flex items-center gap-2 px-5 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
              >
                <Plus size={18} />
                Nova Movimentação
              </Link>
              <Link 
                href="/fluxo-caixa/contas" 
                className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                <CreditCard size={18} />
                Gerenciar Contas
              </Link>
            </div>
          }
        />

        {/* Bento Grid KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <StatCard key={idx} stat={stat} isVisible={isVisible} toggleVisibility={toggleVisibility} />
          ))}
        </div>

        {/* Main Chart & Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Evolução Mensal</h3>
                <p className="text-sm text-slate-400 font-medium mt-1">Comparativo de entradas e saídas por período</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl">
                <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-white text-slate-700 rounded-xl shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Entradas
                </span>
                <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 text-slate-500 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Saídas
                </span>
              </div>
            </div>

            <div className="h-80 w-full">
              {data.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                    <Tooltip 
                      formatter={(val: any) => formatCurrency(Number(val), true)}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="Entradas" fill="#10b981" radius={[8, 8, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Saídas" fill="#f43f5e" radius={[8, 8, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300 font-bold text-sm">
                  Nenhum dado financeiro disponível para o gráfico.
                </div>
              )}
            </div>
          </div>

          {/* Quick Insights / Summary */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div>
              <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 text-indigo-300">
                <PieChartIcon size={24} />
              </div>
              <h3 className="text-xl font-black tracking-tight mb-2">Saúde Financeira</h3>
              <p className="text-sm text-indigo-200/80 font-medium leading-relaxed">
                {data.result >= 0 
                  ? 'Suas finanças estão equilibradas com saldo positivo no período atual. Continue mantendo o controle rigoroso dos custos.' 
                  : 'Atenção: As saídas do mês superam as entradas. Revise os lançamentos recentes para evitar déficits.'}
              </p>
            </div>

            <div className="space-y-4 pt-6 border-t border-white/10 mt-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-indigo-200 font-medium">Contas Ativas</span>
                <span className="font-bold">{data.accounts.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-indigo-200 font-medium">Transações Registradas</span>
                <span className="font-bold">{data.transactions.length}</span>
              </div>
              <Link 
                href="/fluxo-caixa/contas" 
                className="w-full py-3.5 bg-white text-slate-900 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                Gerenciar Contas e Saldos
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        {/* Intelligent Account Grouping & Smart View */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Contas e Saldos</h3>
              <p className="text-sm text-slate-400 font-medium mt-1">Visão inteligente agrupada por tipo de conta</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowZeroBalanceAccounts(!showZeroBalanceAccounts)}
                className={cn(
                  "px-4 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 cursor-pointer",
                  showZeroBalanceAccounts 
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                )}
              >
                <Filter size={14} />
                {showZeroBalanceAccounts ? "Ocultar Contas Zeradas" : "Exibir Contas Zeradas"}
              </button>
              <Link href="/fluxo-caixa/contas" className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                <ChevronRight size={20} />
              </Link>
            </div>
          </div>

          {(() => {
            const filteredAccounts = data.accounts.filter(acc => {
              if (!showZeroBalanceAccounts && Number(acc.current_balance || 0) === 0) return false;
              return true;
            });

            const groupedAccounts = filteredAccounts.reduce((acc: any, account: any) => {
              const name = (account.name || '').toLowerCase();
              let group = 'Contas Correntes';
              if (name.includes('invest') || name.includes('aplic') || name.includes('poupança') || name.includes('fundo') || name.includes('cdb')) {
                group = 'Investimentos';
              } else if (name.includes('caixa') || name.includes('cofre') || name.includes('especie') || name.includes('dinheiro') || name.includes('espécie')) {
                group = 'Caixa Interno';
              }
              if (!acc[group]) acc[group] = [];
              acc[group].push(account);
              return acc;
            }, {});

            const groupKeys = Object.keys(groupedAccounts);

            if (groupKeys.length === 0) {
              return (
                <div className="text-center py-12 text-slate-300">
                  <p className="text-sm font-bold">Nenhuma conta encontrada com os filtros atuais.</p>
                </div>
              );
            }

            return (
              <div className="space-y-8">
                {groupKeys.map(groupName => (
                  <div key={groupName} className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">
                      {groupName} ({groupedAccounts[groupName].length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {groupedAccounts[groupName].map((account: any, idx: number) => (
                        <motion.button 
                          key={account.id} 
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => setSelectedAccountId(selectedAccountId === account.id ? 'all' : account.id)}
                          className={cn(
                            "text-left p-5 rounded-3xl border transition-all duration-300 group relative overflow-hidden cursor-pointer",
                            selectedAccountId === account.id 
                              ? "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                              : "border-slate-50 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-md"
                          )}
                        >
                          <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2.5 rounded-xl transition-colors",
                                selectedAccountId === account.id ? "bg-white/20 text-white" : "bg-white text-indigo-600 shadow-sm"
                              )}>
                                <CreditCard size={18} />
                              </div>
                              <span className={cn(
                                "font-bold tracking-tight text-sm",
                                selectedAccountId === account.id ? "text-white" : "text-slate-900"
                              )}>{account.name}</span>
                            </div>
                          </div>
                          
                          <div className="relative z-10">
                            <p className={cn(
                              "text-xs font-bold uppercase tracking-widest",
                              selectedAccountId === account.id ? "text-white/60" : "text-slate-400"
                            )}>Saldo</p>
                            <p className={cn(
                              "text-lg font-black tracking-tight",
                              selectedAccountId === account.id ? "text-white" : "text-slate-900"
                            )}>
                              {formatCurrency(account.current_balance, isVisible('cashflow_accounts') && isVisible('cashflow_account_' + account.id))}
                            </p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Transactions Extract */}
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
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
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

'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../../dashboard-layout'
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Calendar,
  CreditCard,
  Tag,
  Trash2,
  FileText,
  Download,
  AlertTriangle,
  Eye,
  EyeOff,
  PieChart as PieChartIcon,
  RefreshCw,
  Pencil
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { formatDate, formatCurrency, removeAccents, getTodayBR } from '@/lib/utils'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import Link from 'next/link'
import { useMemo } from 'react'

interface Transaction {
  id: number
  date: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  account_id: number
  category_id?: number
  description: string
  destination_account_id?: number
  bank_accounts?: { name: string }
  financial_categories?: { name: string }
}

/** Labeled row shared by all mobile record cards in this page. */
const CardField = ({ label, children }: { label: string, children: React.ReactNode }) => (
  <div className="min-w-0">
    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
    <div className="min-w-0 mt-1 break-words text-sm text-slate-900">{children}</div>
  </div>
)

const TransactionTypeIcon = ({ type }: { type: string }) => (
  <>
    {type === 'income' && <TrendingUp size={14} className="text-emerald-500 shrink-0" />}
    {type === 'expense' && <TrendingDown size={14} className="text-rose-500 shrink-0" />}
    {type === 'transfer' && <ArrowRightLeft size={14} className="text-indigo-500 shrink-0" />}
  </>
)

const getTransactionCategoryName = (transaction: Transaction) =>
  transaction.financial_categories?.name || (transaction.type === 'transfer' ? 'Transferência' : 'Sem categoria')

const formatTransactionAmount = (transaction: Transaction, isVisible: (key: string) => boolean) =>
  `${transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : ''}${formatCurrency(transaction.amount, isVisible('cashflow_all'))}`

const getTransactionAmountColor = (transaction: Transaction) =>
  transaction.type === 'income' ? 'text-emerald-600' :
  transaction.type === 'expense' ? 'text-rose-600' : 'text-indigo-600'

/** Same touch-friendly actions used by the desktop table and the mobile cards. */
const TransactionActions = ({
  transaction, onEdit, onReclassify, onDelete, className = '', touchOptimized = false
}: {
  transaction: Transaction
  onEdit: (t: Transaction) => void
  onReclassify: (t: Transaction) => void
  onDelete: (t: Transaction) => void
  className?: string
  touchOptimized?: boolean
}) => {
  const buttonClass = cn(
    "inline-flex items-center justify-center touch-manipulation rounded-xl transition-colors",
    touchOptimized ? "min-h-[40px] min-w-[40px] p-2.5" : "min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] p-2.5 sm:p-2",
    "text-slate-700 md:text-slate-500 bg-slate-100 md:bg-transparent border border-slate-200 md:border-transparent"
  )

  return (
    <div className={cn("flex items-center gap-2 sm:gap-2.5", className)}>
      <button onClick={() => onEdit(transaction)} className={cn(buttonClass, "hover:text-indigo-600 hover:bg-indigo-50")} title="Editar descrição" aria-label="Editar descrição">
        <Pencil size={16} />
      </button>
      <button onClick={() => onReclassify(transaction)} className={cn(buttonClass, "hover:text-indigo-600 hover:bg-indigo-50")} title="Reclassificar conta/categoria" aria-label="Reclassificar conta/categoria">
        <RefreshCw size={16} />
      </button>
      <button onClick={() => onDelete(transaction)} className={cn(buttonClass, "hover:text-rose-600 hover:bg-rose-50")} title="Excluir movimentação" aria-label="Excluir movimentação">
        <Trash2 size={16} />
      </button>
    </div>
  )
}

export default function MovimentacoesPage() {
  const { isVisible, toggleVisibility } = usePrivacy()
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [pendingTransaction, setPendingTransaction] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  
  const [displayAmount, setDisplayAmount] = useState('R$ 0,00')
  
  const [formData, setFormData] = useState({
    date: getTodayBR(),
    amount: 0,
    type: 'expense' as 'income' | 'expense' | 'transfer',
    account_id: '',
    category_id: '',
    description: '',
    destination_account_id: ''
  })

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [chartDataExpense, setChartDataExpense] = useState<any[]>([])
  const [chartDataIncome, setChartDataIncome] = useState<any[]>([])
  const [isReclassifyModalOpen, setIsReclassifyModalOpen] = useState(false)
  const [reclassifyingTx, setReclassifyingTx] = useState<Transaction | null>(null)
  const [reclassifyAccountId, setReclassifyAccountId] = useState('')
  const [reclassifyCategoryId, setReclassifyCategoryId] = useState('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  useEffect(() => {
    // Parse query params for initial filters
    const params = new URLSearchParams(window.location.search)
    const catId = params.get('categoryId')
    const start = params.get('startDate')
    const end = params.get('endDate')
    const accId = params.get('accountId')

    if (catId) setCategoryFilter(catId)
    if (start) setStartDate(start)
    if (end) setEndDate(end)
    if (accId) setAccountFilter(accId)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setMounted(true)
        setLoading(false)
        return
      }

      let query = supabase.from('financial_transactions').select('*, bank_accounts!account_id(name), financial_categories(name)').order('date', { ascending: false })

      if (startDate) {
        query = query.gte('date', startDate)
      }
      if (endDate) {
        query = query.lte('date', endDate)
      }

      const [transRes, accRes, catRes, summaryRes, incomeRes, expenseRes] = await Promise.all([
        query,
        supabase.from('bank_accounts').select('*').order('name'),
        supabase.from('financial_categories').select('*').order('name'),
        supabase.rpc('get_financial_summary', {
          p_start_date: startDate || '1900-01-01',
          p_end_date: endDate || '2100-01-01',
          p_account_id: accountFilter === 'all' ? null : Number(accountFilter),
          p_category_id: categoryFilter === 'all' ? null : Number(categoryFilter),
          p_environment: 'production'
        }),
        supabase.rpc('get_financial_chart_data', {
          p_start_date: startDate || '1900-01-01',
          p_end_date: endDate || '2100-01-01',
          p_type: 'income',
          p_environment: 'production'
        }),
        supabase.rpc('get_financial_chart_data', {
          p_start_date: startDate || '1900-01-01',
          p_end_date: endDate || '2100-01-01',
          p_type: 'expense',
          p_environment: 'production'
        })
      ])
      
      setTransactions(transRes.data || [])
      setAccounts(accRes.data || [])
      setCategories(catRes.data || [])

      const summaryData = summaryRes.data || []
      setTotalIncome(Number(summaryData.find((s: any) => s.transaction_type === 'income')?.total_amount || 0))
      setTotalExpense(Number(summaryData.find((s: any) => s.transaction_type === 'expense')?.total_amount || 0))
      setChartDataIncome(incomeRes.data || [])
      setChartDataExpense(expenseRes.data || [])

      setLoading(false)
      setMounted(true)
    }

    fetchData()
  }, [startDate, endDate, accountFilter, categoryFilter])

  const processedExpenseData = useMemo(() => {
    if (!chartDataExpense || chartDataExpense.length === 0) return [];
    
    const total = chartDataExpense.reduce((sum: number, item: any) => sum + Number(item.total_amount), 0);
    const threshold = total * 0.03; // 3%
    
    const mainItems = chartDataExpense.filter((item: any) => Number(item.total_amount) >= threshold);
    const others = chartDataExpense.filter((item: any) => Number(item.total_amount) < threshold);
    
    const othersTotal = others.reduce((sum: number, item: any) => sum + Number(item.total_amount), 0);
    
    const result = [...mainItems];
    if (othersTotal > 0) {
      result.push({ category_name: 'Outros', total_amount: othersTotal });
    }
    
    // Sort by amount descending
    return result.sort((a: any, b: any) => Number(b.total_amount) - Number(a.total_amount));
  }, [chartDataExpense]);

  const processedIncomeData = useMemo(() => {
    if (!chartDataIncome || chartDataIncome.length === 0) return [];
    
    const total = chartDataIncome.reduce((sum: number, item: any) => sum + Number(item.total_amount), 0);
    const threshold = total * 0.03; // 3%
    
    const mainItems = chartDataIncome.filter((item: any) => Number(item.total_amount) >= threshold);
    const others = chartDataIncome.filter((item: any) => Number(item.total_amount) < threshold);
    
    const othersTotal = others.reduce((sum: number, item: any) => sum + Number(item.total_amount), 0);
    
    const result = [...mainItems];
    if (othersTotal > 0) {
      result.push({ category_name: 'Outros', total_amount: othersTotal });
    }
    
    // Sort by amount descending
    return result.sort((a: any, b: any) => Number(b.total_amount) - Number(a.total_amount));
  }, [chartDataIncome]);

  if (!mounted) return null

  const filteredTransactions = transactions.filter(t => {
    const term = removeAccents(searchTerm).toLowerCase()
    const matchesSearch = removeAccents(t.description.toLowerCase()).includes(term)
    const matchesType = typeFilter === 'all' || t.type === typeFilter
    const matchesAccount = accountFilter === 'all' || t.account_id.toString() === accountFilter
    const matchesCategory = categoryFilter === 'all' || (t.category_id && t.category_id.toString() === categoryFilter)
    return matchesSearch && matchesType && matchesAccount && matchesCategory
  })

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.account_id) {
      alert('Selecione uma conta bancária.')
      return
    }

    if (formData.type === 'expense' || formData.type === 'transfer') {
      const selectedAccount = accounts.find(a => a.id.toString() === formData.account_id?.toString());
      if (selectedAccount) {
        const currentBalance = Number(selectedAccount.current_balance || 0);
        const amountToDeduct = Number(formData.amount);
        
        if (currentBalance < amountToDeduct) {
          setPendingTransaction({
            accountName: selectedAccount.name,
            currentBalance: currentBalance
          });
          setConfirmModalOpen(true);
          return;
        }
      }
    }

    executeTransaction();
  }

  const executeTransaction = async () => {
    setConfirmModalOpen(false);
    
    const transactionData = {
      date: formData.date,
      amount: Number(formData.amount),
      type: formData.type,
      account_id: formData.account_id ? String(formData.account_id) : null,
      category_id: formData.category_id ? String(formData.category_id) : null,
      description: formData.description,
      destination_account_id: formData.type === 'transfer' ? (formData.destination_account_id ? String(formData.destination_account_id) : null) : null,
      created_by: user?.id ? String(user.id) : null
    }

    try {
      // 1. Insert Transaction
      let result = await supabase
        .from('financial_transactions')
        .insert([transactionData])
        .select('*, bank_accounts!account_id(name), financial_categories(name)')
      
      // Retry logic for stale user ID (Foreign Key Violation)
      if (result.error && result.error.code === '23503') {
        console.warn('Erro de chave estrangeira (usuário inválido?), tentando salvar sem created_by...')
        const retryData = { ...transactionData, created_by: null }
        result = await supabase
          .from('financial_transactions')
          .insert([retryData])
          .select('*, bank_accounts!account_id(name), financial_categories(name)')
      }
      
      if (result.error) throw result.error
      const data = result.data

      // 2. Update Account Balance(s)
      if (formData.type === 'income') {
        await supabase.rpc('update_account_balance', { acc_id: String(formData.account_id), amount_change: Number(formData.amount) })
      } else if (formData.type === 'expense') {
        await supabase.rpc('update_account_balance', { acc_id: String(formData.account_id), amount_change: -Number(formData.amount) })
      } else if (formData.type === 'transfer') {
        await supabase.rpc('update_account_balance', { acc_id: String(formData.account_id), amount_change: -Number(formData.amount) })
        await supabase.rpc('update_account_balance', { acc_id: String(formData.destination_account_id), amount_change: Number(formData.amount) })
      }

      const updateBalance = async (id: string, change: number) => {
        const acc = accounts.find(a => a.id === id)
        if (acc) {
          await supabase.from('bank_accounts').update({ current_balance: Number(acc.current_balance) + change }).eq('id', id)
        }
      }

      if (formData.type === 'income') await updateBalance(String(formData.account_id), Number(formData.amount))
      if (formData.type === 'expense') await updateBalance(String(formData.account_id), -Number(formData.amount))
      if (formData.type === 'transfer') {
        await updateBalance(String(formData.account_id), -Number(formData.amount))
        await updateBalance(String(formData.destination_account_id), Number(formData.amount))
      }

      if (data) setTransactions(prev => [data[0], ...prev])
      setIsModalOpen(false)
      setFormData({
        date: getTodayBR(),
        amount: 0,
        type: 'expense',
        account_id: '',
        category_id: '',
        description: '',
        destination_account_id: ''
      })
      setDisplayAmount('R$ 0,00')
      
      // Refresh accounts to get new balances
      const { data: newAccs } = await supabase.from('bank_accounts').select('*').order('name')
      if (newAccs) setAccounts(newAccs)

    } catch (error: any) {
      console.error('Error saving transaction:', error)
      alert(`Erro ao salvar movimentação: ${error.message || error.details || JSON.stringify(error)}`)
    }
  }

  const openReclassifyModal = (tx: Transaction) => {
    setReclassifyingTx(tx)
    setReclassifyAccountId(tx.account_id ? tx.account_id.toString() : '')
    setReclassifyCategoryId(tx.category_id ? tx.category_id.toString() : '')
    setIsReclassifyModalOpen(true)
  }

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx)
    setEditDescription(tx.description || '')
    setIsEditModalOpen(true)
  }

  const handleReclassifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reclassifyingTx) return

    try {
      const { error } = await supabase
        .from('financial_transactions')
        .update({
          account_id: reclassifyAccountId ? Number(reclassifyAccountId) : null,
          category_id: reclassifyCategoryId ? Number(reclassifyCategoryId) : null
        })
        .eq('id', reclassifyingTx.id)

      if (error) throw error

      setTransactions(prev => prev.map(t => {
        if (t.id === reclassifyingTx.id) {
          const acc = accounts.find(a => a.id.toString() === reclassifyAccountId)
          const cat = categories.find(c => c.id.toString() === reclassifyCategoryId)
          return {
            ...t,
            account_id: Number(reclassifyAccountId),
            category_id: reclassifyCategoryId ? Number(reclassifyCategoryId) : undefined,
            bank_accounts: acc ? { name: acc.name } : t.bank_accounts,
            financial_categories: cat ? { name: cat.name } : undefined
          }
        }
        return t
      }))

      setIsReclassifyModalOpen(false)
      setReclassifyingTx(null)
      alert('Movimentação reclassificada com sucesso!')
    } catch (err: any) {
      console.error('Erro ao reclassificar:', err)
      alert(`Erro ao reclassificar: ${err.message || err.details || JSON.stringify(err)}`)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTx) return
    const newDesc = editDescription.trim()
    if (!newDesc) {
      alert('A descrição é obrigatória.')
      return
    }
    try {
      const { error } = await supabase
        .from('financial_transactions')
        .update({ description: newDesc })
        .eq('id', editingTx.id)

      if (error) throw error

      setTransactions(prev => prev.map(t => (t.id === editingTx.id ? { ...t, description: newDesc } : t)))
      setIsEditModalOpen(false)
      setEditingTx(null)
      alert('Descrição atualizada com sucesso!')
    } catch (err: any) {
      console.error('Erro ao editar descrição:', err)
      alert(`Erro ao editar descrição: ${err.message || err.details || JSON.stringify(err)}`)
    }
  }

  const handleDelete = async (transaction: Transaction) => {
    if (window.confirm('Tem certeza que deseja excluir esta movimentação? O saldo das contas será estornado.')) {
      try {
        // 1. Estornar saldo
        const updateBalance = async (id: number, change: number) => {
          const acc = accounts.find(a => a.id === id)
          if (acc) {
            await supabase.from('bank_accounts').update({ current_balance: Number(acc.current_balance) + change }).eq('id', id)
          }
        }

        if (transaction.type === 'income') await updateBalance(transaction.account_id, -Number(transaction.amount))
        if (transaction.type === 'expense') await updateBalance(transaction.account_id, Number(transaction.amount))
        if (transaction.type === 'transfer') {
          await updateBalance(transaction.account_id, Number(transaction.amount))
          if (transaction.destination_account_id) await updateBalance(transaction.destination_account_id, -Number(transaction.amount))
        }

        // 2. Deletar transação
        await supabase.from('financial_transactions').delete().eq('id', transaction.id)
        
        setTransactions(prev => prev.filter(t => t.id !== transaction.id))
        
        // Refresh accounts
        const { data: newAccs } = await supabase.from('bank_accounts').select('*').order('name')
        if (newAccs) setAccounts(newAccs)
      } catch (error) {
        console.error('Error deleting transaction:', error)
      }
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/fluxo-caixa" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              Movimentações
              <button 
                onClick={() => toggleVisibility('cashflow_all')}
                className="text-slate-400 hover:text-slate-600 transition-colors ml-2"
                title={isVisible('cashflow_all') ? "Ocultar valores" : "Mostrar valores"}
              >
                {isVisible('cashflow_all') ? <Eye size={24} /> : <EyeOff size={24} />}
              </button>
            </h1>
            <p className="text-slate-500 mt-1">Extrato detalhado de entradas, saídas e transferências.</p>
          </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm text-slate-500 font-medium">Entradas</h3>
            <p className="text-2xl font-bold text-emerald-600">+{formatCurrency(totalIncome, isVisible('cashflow_all'))}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm text-slate-500 font-medium">Saídas</h3>
            <p className="text-2xl font-bold text-rose-600">-{formatCurrency(totalExpense, isVisible('cashflow_all'))}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm text-slate-500 font-medium">Saldo</h3>
            <p className="text-2xl font-bold text-indigo-900">{formatCurrency(totalIncome - totalExpense, isVisible('cashflow_all'))}</p>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <PieChartIcon size={20} className="text-emerald-500" />
              Distribuição de Entradas
            </h3>
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedIncomeData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => isVisible('cashflow_all') ? value : '•••'} />
                  <YAxis dataKey="category_name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0), isVisible('cashflow_all'))} />
                  <Bar dataKey="total_amount" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="max-h-40 overflow-y-auto pr-3 [scrollbar-gutter:stable]">
              <table className="w-full text-xs table-fixed">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="text-left py-1 pr-2">Categoria</th>
                    <th className="text-right py-1 pl-2 w-[110px] sm:w-[130px]">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {processedIncomeData.map((item: any, index: number) => (
                    <tr key={index} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-2 truncate" title={item.category_name}>{item.category_name}</td>
                      <td className="text-right py-1.5 pl-2 whitespace-nowrap tabular-nums">{formatCurrency(Number(item.total_amount), isVisible('cashflow_all'))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <PieChartIcon size={20} className="text-rose-500" />
              Distribuição de Despesas
            </h3>
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedExpenseData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => isVisible('cashflow_all') ? value : '•••'} />
                  <YAxis dataKey="category_name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0), isVisible('cashflow_all'))} />
                  <Bar dataKey="total_amount" fill="#f43f5e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="max-h-40 overflow-y-auto pr-3 [scrollbar-gutter:stable]">
              <table className="w-full text-xs table-fixed">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="text-left py-1 pr-2">Categoria</th>
                    <th className="text-right py-1 pl-2 w-[110px] sm:w-[130px]">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {processedExpenseData.map((item: any, index: number) => (
                    <tr key={index} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-2 truncate" title={item.category_name}>{item.category_name}</td>
                      <td className="text-right py-1.5 pl-2 whitespace-nowrap tabular-nums">{formatCurrency(Number(item.total_amount), isVisible('cashflow_all'))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <div className="relative lg:col-span-2 xl:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Buscar por descrição..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-2 xl:col-span-2">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 min-w-[160px]">
                <span className="text-xs text-slate-500 font-medium">De:</span>
                <input 
                  type="date"
                  className="bg-transparent text-sm outline-none text-slate-700 w-full"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 min-w-[160px]">
                <span className="text-xs text-slate-500 font-medium">Até:</span>
                <input 
                  type="date"
                  className="bg-transparent text-sm outline-none text-slate-700 w-full"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <select 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">Todos os Tipos</option>
              <option value="income">Entradas</option>
              <option value="expense">Saídas</option>
              <option value="transfer">Transferências</option>
            </select>

            <select 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
              value={accountFilter}
              onChange={e => setAccountFilter(e.target.value)}
            >
              <option value="all">Todas as Contas</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>

            <select 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="all">Todas as Categorias</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100 sm:border-0 sm:pt-0 sm:justify-end">
            <button className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors w-full sm:w-auto">
              <Download size={18} />
              <span className="sm:hidden lg:inline">Exportar</span>
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto"
            >
              <Plus size={20} />
              Novo Lançamento
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="hidden md:block overflow-x-auto w-full">
            <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-[100px] px-6 py-4 text-sm font-semibold text-slate-600 whitespace-nowrap">Data</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 whitespace-nowrap">Descrição</th>
                  <th className="w-[150px] px-6 py-4 text-sm font-semibold text-slate-600 whitespace-nowrap">Categoria</th>
                  <th className="w-[150px] px-6 py-4 text-sm font-semibold text-slate-600 whitespace-nowrap">Conta</th>
                  <th className="w-[140px] px-6 py-4 text-sm font-semibold text-slate-600 text-right whitespace-nowrap">Valor</th>
                  <th className="w-[168px] px-4 sm:px-6 py-4 text-sm font-semibold text-slate-600 text-center whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-6 py-4 truncate">
                      <div className="flex items-center gap-2">
                        <TransactionTypeIcon type={transaction.type} />
                        <span className="font-medium text-slate-900 truncate">{transaction.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 truncate">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium truncate inline-block max-w-full">
                        {getTransactionCategoryName(transaction)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 truncate">
                      {transaction.bank_accounts?.name}
                    </td>
                    <td className={cn("px-6 pr-4 sm:pr-6 py-4 text-right font-bold whitespace-nowrap", getTransactionAmountColor(transaction))}>
                      {formatTransactionAmount(transaction, isVisible)}
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <TransactionActions
                        transaction={transaction}
                        onEdit={openEditModal}
                        onReclassify={openReclassifyModal}
                        onDelete={handleDelete}
                        className="justify-end md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity"
                      />
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      Nenhuma movimentação encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400">Nenhuma movimentação encontrada.</div>
            ) : (
              filteredTransactions.map((transaction) => (
                <div key={transaction.id} className="p-4 space-y-3">
                  <CardField label="Data">{formatDate(transaction.date)}</CardField>
                  <CardField label="Descrição">
                    <div className="flex items-start gap-2">
                      <TransactionTypeIcon type={transaction.type} />
                      <span className="font-medium">{transaction.description}</span>
                    </div>
                  </CardField>
                  <CardField label="Categoria">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                      {getTransactionCategoryName(transaction)}
                    </span>
                  </CardField>
                  <CardField label="Conta">
                    <span className="text-slate-600">{transaction.bank_accounts?.name}</span>
                  </CardField>
                  <CardField label="Valor">
                    <span className={cn("text-base font-bold", getTransactionAmountColor(transaction))}>
                      {formatTransactionAmount(transaction, isVisible)}
                    </span>
                  </CardField>
                  <CardField label="Ações">
                    <TransactionActions
                      transaction={transaction}
                      onEdit={openEditModal}
                      onReclassify={openReclassifyModal}
                      onDelete={handleDelete}
                      touchOptimized
                    />
                  </CardField>
                </div>
              ))
            )}
          </div>
        </div>

        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title="Novo Lançamento Financeiro"
        >
          <form onSubmit={handlePreSubmit} className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income' })}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all",
                  formData.type === 'income' ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-100 text-slate-500"
                )}
              >
                <TrendingUp size={20} />
                <span className="text-xs font-bold">Receita</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense' })}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all",
                  formData.type === 'expense' ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-100 text-slate-500"
                )}
              >
                <TrendingDown size={20} />
                <span className="text-xs font-bold">Despesa</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'transfer' })}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all",
                  formData.type === 'transfer' ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-100 text-slate-500"
                )}
              >
                <ArrowRightLeft size={20} />
                <span className="text-xs font-bold">Transferência</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                <input 
                  required
                  type="date" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                  value={displayAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    const numberValue = Number(value) / 100
                    setDisplayAmount(formatCurrency(numberValue, true))
                    setFormData({ ...formData, amount: numberValue })
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Pagamento Aluguel, Honorários Cliente X"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {formData.type === 'transfer' ? 'Conta de Origem' : 'Conta Bancária'}
                </label>
                <select 
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={formData.account_id}
                  onChange={e => setFormData({ ...formData, account_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              
              {formData.type === 'transfer' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Conta de Destino</label>
                  <select 
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.destination_account_id}
                    onChange={e => setFormData({ ...formData, destination_account_id: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {accounts.filter(a => a.id.toString() !== formData.account_id).map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.category_id}
                    onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                  >
                    <option value="">Sem categoria</option>
                    {categories.filter(c => c.type === formData.type).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-md"
              >
                Salvar Lançamento
              </button>
            </div>
          </form>
        </Modal>

        <Modal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Atenção: Saldo Insuficiente"
        >
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm text-rose-800 font-medium">
                  A conta <strong>{pendingTransaction?.accountName}</strong> possui saldo de apenas <strong>{formatCurrency(pendingTransaction?.currentBalance)}</strong>.
                </p>
                <p className="text-sm text-rose-700 mt-1">
                  Esta operação deixará a conta com saldo negativo. Deseja continuar mesmo assim?
                </p>
              </div>
            </div>
            <div className="pt-4 flex gap-3">
              <button 
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={executeTransaction}
                className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors shadow-md"
              >
                Sim, Continuar
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isReclassifyModalOpen}
          onClose={() => setIsReclassifyModalOpen(false)}
          title="Reclassificar Movimentação"
        >
          <form onSubmit={handleReclassifySubmit} className="space-y-5">
            <div>
              <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                Alterando classificação para: <strong className="text-slate-900">{reclassifyingTx?.description}</strong> ({formatCurrency(reclassifyingTx?.amount || 0)})
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancária</label>
              <select 
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={reclassifyAccountId}
                onChange={e => setReclassifyAccountId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            {reclassifyingTx?.type !== 'transfer' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria Financeira</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={reclassifyCategoryId}
                  onChange={e => setReclassifyCategoryId(e.target.value)}
                >
                  <option value="">Sem categoria</option>
                  {categories
                    .filter(c => !reclassifyingTx || c.type === reclassifyingTx.type)
                    .map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
              </div>
            )}

            <div className="pt-4 flex gap-3">
              <button 
                type="button"
                onClick={() => setIsReclassifyModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-md"
              >
                Salvar Reclassificação
              </button>
            </div>
          </form>
        </Modal>

        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Editar descrição do lançamento"
        >
          <form onSubmit={handleEditSubmit} className="space-y-5">
            <div>
              <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                Lançamento: <strong className="text-slate-900">{formatDate(editingTx?.date || '')} • {formatCurrency(editingTx?.amount || 0)}</strong>
              </p>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
              <input
                required
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Ex: Presente Aniversário Janaina"
              />
              <p className="text-xs text-slate-500 mt-2">Apenas a descrição será alterada. Valor, data, tipo, conta e categoria permanecem inalterados.</p>
            </div>
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-md"
              >
                Salvar descrição
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}

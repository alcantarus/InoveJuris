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
  EyeOff
} from 'lucide-react'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { formatDate, formatCurrency, removeAccents, getTodayBR } from '@/lib/utils'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import Link from 'next/link'

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

      const [transRes, accRes, catRes] = await Promise.all([
        query,
        supabase.from('bank_accounts').select('*').order('name'),
        supabase.from('financial_categories').select('*').order('name')
      ])
      
      setTransactions(transRes.data || [])
      setAccounts(accRes.data || [])
      setCategories(catRes.data || [])
      setLoading(false)
      setMounted(true)
    }

    fetchData()
  }, [startDate, endDate])

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
                onClick={() => toggleVisibility('cashflow_transactions')}
                className="text-slate-400 hover:text-slate-600 transition-colors ml-2"
                title={isVisible('cashflow_transactions') ? "Ocultar valores" : "Mostrar valores"}
              >
                {isVisible('cashflow_transactions') ? <Eye size={24} /> : <EyeOff size={24} />}
              </button>
            </h1>
            <p className="text-slate-500 mt-1">Extrato detalhado de entradas, saídas e transferências.</p>
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
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[800px] lg:min-w-0">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Data</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Descrição</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Categoria</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Conta</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Valor</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600"></th>
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
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {transaction.type === 'income' && <TrendingUp size={14} className="text-emerald-500" />}
                        {transaction.type === 'expense' && <TrendingDown size={14} className="text-rose-500" />}
                        {transaction.type === 'transfer' && <ArrowRightLeft size={14} className="text-indigo-500" />}
                        <span className="font-medium text-slate-900">{transaction.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                        {transaction.financial_categories?.name || (transaction.type === 'transfer' ? 'Transferência' : 'Sem categoria')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {transaction.bank_accounts?.name}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${
                      transaction.type === 'income' ? 'text-emerald-600' : 
                      transaction.type === 'expense' ? 'text-rose-600' : 'text-indigo-600'
                    }`}>
                      {transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : ''}
                      {formatCurrency(transaction.amount, isVisible('cashflow_transactions'))}
                    </td>
                    <td className="px-6 py-4 text-right md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleDelete(transaction)}
                        className="p-2 text-slate-600 md:text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-slate-50 md:bg-transparent rounded-lg transition-colors"
                        title="Excluir Movimentação"
                      >
                        <Trash2 size={16} />
                      </button>
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
      </div>
    </DashboardLayout>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}

'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../../dashboard-layout'
import { 
  Plus, 
  CreditCard, 
  Trash2, 
  Edit2, 
  ArrowLeft,
  Search,
  AlertTriangle,
  Wallet,
  Eye,
  EyeOff
} from 'lucide-react'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { formatCurrency, formatDate } from '@/lib/utils'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import Link from 'next/link'

interface BankAccount {
  id: number
  name: string
  type: string
  initial_balance: number
  current_balance: number
  created_at: string
  previous_balance?: number
  period_income?: number
  period_expense?: number
}

export default function ContasBancariasPage() {
  const { isVisible, toggleVisibility } = usePrivacy()
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'Corrente',
    initial_balance: 0
  })

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAccounts = async () => {
      if (!isSupabaseConfigured) {
        setMounted(true)
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

        // 2. If date filter is applied, calculate balance based on transactions
        if (startDate || endDate) {
          const effectiveEndDate = endDate || new Date().toISOString().split('T')[0]
          
          const { data: allHistory, error: histError } = await supabase
            .from('financial_transactions')
            .select('account_id, amount, type, destination_account_id, date')
            .lte('date', effectiveEndDate)
            
          if (histError) throw histError

          const accountsWithHistory = (accountsData || []).map((acc: BankAccount) => {
            let balance = acc.initial_balance || 0
            let previousBalance = acc.initial_balance || 0
            let periodIncome = 0
            let periodExpense = 0
            
            allHistory?.forEach((t: any) => {
              const isBeforeStart = startDate ? t.date < startDate : false
              const isInPeriod = (!startDate || t.date >= startDate) && t.date <= effectiveEndDate

              // Calculate logic for this transaction
              let amountChange = 0
              let isIncome = false
              
              if (t.account_id === acc.id) {
                if (t.type === 'income') { amountChange += t.amount; isIncome = true; }
                if (t.type === 'expense') { amountChange -= t.amount; }
                if (t.type === 'transfer') { amountChange -= t.amount; }
              }
              if (t.destination_account_id === acc.id && t.type === 'transfer') {
                amountChange += t.amount; isIncome = true;
              }

              // Apply to balances
              balance += amountChange
              
              if (isBeforeStart) {
                previousBalance += amountChange
              }
              
              if (isInPeriod) {
                if (amountChange > 0) periodIncome += amountChange
                if (amountChange < 0) periodExpense += Math.abs(amountChange)
              }
            })
            
            return { 
              ...acc, 
              current_balance: balance,
              previous_balance: previousBalance,
              period_income: periodIncome,
              period_expense: periodExpense
            }
          })
          
          setAccounts(accountsWithHistory)
        } else {
          setAccounts(accountsData || [])
        }
      } catch (error) {
        console.error('Error fetching accounts:', error)
      } finally {
        setLoading(false)
        setMounted(true)
      }
    }

    fetchAccounts()
  }, [startDate, endDate])

  if (!mounted) return null

  const handleOpenModal = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account)
      setFormData({
        name: account.name,
        type: account.type,
        initial_balance: account.initial_balance
      })
    } else {
      setEditingAccount(null)
      setFormData({
        name: '',
        type: 'Corrente',
        initial_balance: 0
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingAccount) {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ 
          name: formData.name, 
          type: formData.type,
          // Note: initial_balance usually shouldn't be changed after creation if it affects current_balance logic
          // but for simplicity here we just update it
        })
        .eq('id', editingAccount.id)
      
      if (error) {
        console.error('Error updating account:', error)
        alert('Erro ao atualizar conta.')
      } else {
        setAccounts(prev => prev.map(a => a.id === editingAccount.id ? { ...a, ...formData } : a))
        setIsModalOpen(false)
      }
    } else {
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert([{ 
          ...formData, 
          current_balance: formData.initial_balance,
          created_by: user?.id || null 
        }])
        .select()
      
      if (error) {
        console.error('Error creating account:', error)
        alert(`Erro ao criar conta: ${error.message || error.details || JSON.stringify(error)}`)
      } else {
        if (data) setAccounts(prev => [...prev, data[0]])
        setIsModalOpen(false)
      }
    }
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta conta? Todas as movimentações vinculadas serão afetadas.')) {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error('Error deleting account:', error)
        alert('Erro ao excluir conta.')
      } else {
        setAccounts(prev => prev.filter(a => a.id !== id))
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
              Contas Bancárias
              <button 
                onClick={() => toggleVisibility('cashflow_accounts')}
                className="text-slate-400 hover:text-slate-600 transition-colors ml-2"
                title={isVisible('cashflow_accounts') ? "Ocultar valores" : "Mostrar valores"}
              >
                {isVisible('cashflow_accounts') ? <Eye size={24} /> : <EyeOff size={24} />}
              </button>
            </h1>
            <p className="text-slate-500 mt-1">Gerencie suas contas, caixas e carteiras.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-500 font-medium">De:</span>
              <input 
                type="date"
                className="bg-transparent text-sm outline-none text-slate-700"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-500 font-medium">Até:</span>
              <input 
                type="date"
                className="bg-transparent text-sm outline-none text-slate-700"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Nova Conta
          </button>
        </div>

        {(startDate || endDate) ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 text-blue-800 text-sm">
            <AlertTriangle size={18} className="text-blue-600" />
            <p>
              Visualizando extrato {startDate ? `de ${formatDate(startDate)}` : ''} {endDate ? `até ${formatDate(endDate)}` : ''}. 
              Movimentações fora deste período não estão incluídas no cálculo de entradas/saídas.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <motion.div 
              key={account.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Wallet size={24} />
                </div>
                <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleOpenModal(account)}
                    className="p-2 text-slate-600 md:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 bg-slate-50 md:bg-transparent rounded-lg transition-colors"
                    title="Editar Conta"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(account.id)}
                    className="p-2 text-slate-600 md:text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-slate-50 md:bg-transparent rounded-lg transition-colors"
                    title="Excluir Conta"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-slate-900">{account.name}</h3>
                <p className="text-sm text-slate-500 uppercase font-medium tracking-wider">{account.type}</p>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 space-y-2">
                {(startDate && endDate) ? (
                   <>
                     <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Saldo Anterior:</span>
                        <span className="font-medium">{formatCurrency(account.previous_balance || 0, isVisible('cashflow_accounts'))}</span>
                     </div>
                     <div className="flex justify-between text-xs">
                        <span className="text-emerald-600">Entradas:</span>
                        <span className="font-medium text-emerald-600">+{formatCurrency(account.period_income || 0, isVisible('cashflow_accounts'))}</span>
                     </div>
                     <div className="flex justify-between text-xs">
                        <span className="text-rose-600">Saídas:</span>
                        <span className="font-medium text-rose-600">-{formatCurrency(account.period_expense || 0, isVisible('cashflow_accounts'))}</span>
                     </div>
                     <div className="pt-2 border-t border-slate-50 flex justify-between items-end">
                        <span className="text-xs text-slate-400 font-medium uppercase">Saldo Final</span>
                        <span className="text-xl font-bold text-slate-900">{formatCurrency(account.current_balance, isVisible('cashflow_accounts'))}</span>
                     </div>
                   </>
                ) : (
                    <>
                        <p className="text-xs text-slate-400 font-medium uppercase">Saldo Atual</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">
                        {formatCurrency(account.current_balance, isVisible('cashflow_accounts'))}
                        </p>
                    </>
                )}
              </div>
            </motion.div>
          ))}

          {accounts.length === 0 && (
            <div className="md:col-span-2 lg:col-span-3 p-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-center">
              <CreditCard className="mx-auto text-slate-300 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-slate-900">Nenhuma conta cadastrada</h3>
              <p className="text-slate-500 mt-1">Cadastre sua primeira conta bancária ou caixa para começar.</p>
              <button 
                onClick={() => handleOpenModal()}
                className="mt-6 inline-flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-700"
              >
                <Plus size={20} />
                Cadastrar agora
              </button>
            </div>
          )}
        </div>

        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingAccount ? 'Editar Conta' : 'Nova Conta Bancária'}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Conta / Banco</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Itaú, Caixa, Pix, Dinheiro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Conta</label>
              <select 
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
              >
                <option>Corrente</option>
                <option>Poupança</option>
                <option>Investimento</option>
                <option>Caixa Interno</option>
                <option>Outros</option>
              </select>
            </div>

            {!editingAccount && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Saldo Inicial</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    className="w-full pl-12 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.initial_balance}
                    onChange={e => setFormData({ ...formData, initial_balance: Number(e.target.value) })}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">Este valor será o saldo de abertura da conta.</p>
              </div>
            )}

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
                {editingAccount ? 'Salvar Alterações' : 'Criar Conta'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  )
}

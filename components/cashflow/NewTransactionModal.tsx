'use client'

import React, { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { ArrowRightLeft, TrendingDown, TrendingUp } from 'lucide-react'
import { formatCurrency, getTodayBR } from '@/lib/utils'

export interface NewTransactionData {
  date: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  account_id: string
  category_id: string
  description: string
  destination_account_id: string
}

const emptyForm = (): NewTransactionData => ({
  date: getTodayBR(),
  amount: 0,
  type: 'expense',
  account_id: '',
  category_id: '',
  description: '',
  destination_account_id: ''
})

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}

type Props = {
  isOpen: boolean
  onClose: () => void
  accounts: any[]
  categories: any[]
  onSubmit: (data: NewTransactionData) => void
}

/**
 * Formulário de novo lançamento financeiro.
 *
 * O estado vive aqui (e não na página) para que a digitação não provoque
 * re-render dos gráficos e da tabela de movimentações. A página só recebe
 * os dados no submit e continua responsável pela gravação.
 */
export const NewTransactionModal = React.memo(function NewTransactionModal({
  isOpen,
  onClose,
  accounts,
  categories,
  onSubmit
}: Props) {
  const [formData, setFormData] = useState<NewTransactionData>(emptyForm)
  const [displayAmount, setDisplayAmount] = useState('R$ 0,00')

  useEffect(() => {
    if (!isOpen) {
      setFormData(emptyForm())
      setDisplayAmount('R$ 0,00')
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.account_id) {
      alert('Selecione uma conta bancária.')
      return
    }
    onSubmit({ ...formData })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Lançamento Financeiro">
      <form onSubmit={handleSubmit} className="space-y-5">
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
            onClick={onClose}
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
  )
})

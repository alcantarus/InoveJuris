'use client'

import React, { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { CurrencyInput } from '@/components/CurrencyInput'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, getTodayBR } from '@/lib/utils'
import { toast } from 'react-hot-toast'

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

export interface LastPaymentSelection {
  account: string
  category: string
  method: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  installment: any
  installmentLabel: string
  clientName?: string
  bankAccounts: any[]
  financialCategories: any[]
  userId?: string | number | null
  isVisible: (key: string) => boolean
  onSuccess: (selection: LastPaymentSelection) => void
}

export const ReceiveInstallmentModal = React.memo(function ReceiveInstallmentModal({
  isOpen,
  onClose,
  installment,
  installmentLabel,
  clientName,
  bankAccounts,
  financialCategories,
  userId,
  isVisible,
  onSuccess,
}: Props) {
  // Estado local: digitar não re-renderiza a página pesada de parcelas.
  const [amount, setAmount] = useState(0)
  const [account, setAccount] = useState('')
  const [method, setMethod] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!isOpen || !installment?.id) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('payments')
        .select('*, bank_accounts(name), financial_categories(name)')
        .eq('installment_id', installment.id)
        .order('payment_date', { ascending: false })
      if (!cancelled) setHistory(data || [])
    })()
    return () => { cancelled = true }
  }, [isOpen, installment?.id])

  const handleConfirm = async () => {
    if (processing) return
    if (!account || !category || !method) {
      toast.error('Selecione a conta, a categoria e a forma de pagamento.')
      return
    }

    const valor = Number(amount)
    const saldo = Number(installment?.amount || 0) - Number(installment?.amountPaid || 0)
    if (valor <= 0) {
      toast.error('Informe um valor maior que zero.')
      return
    }
    if (valor > saldo + 0.01) {
      toast.error('O valor não pode ser maior que o saldo da parcela.')
      return
    }

    const isPartial = valor < saldo - 0.01
    setProcessing(true)
    try {
      const { error } = await supabase.rpc('rpc_receber_parcela_com_metodo', {
        p_installment_id: installment.id,
        p_amount_paid: valor,
        p_date: getTodayBR(),
        p_description: description,
        p_account_id: account,
        p_category_id: category,
        p_payment_method: method,
        p_user_id: userId,
        p_interest: 0,
        p_fine: 0,
      })
      if (error) {
        toast.error(error.message || 'Erro ao processar pagamento')
        console.error(error)
        return
      }
      toast.success(
        isPartial
          ? 'Pagamento parcial processado com desdobramento!'
          : 'Pagamento processado com sucesso!'
      )
      onSuccess({ account, category, method })
      onClose()
    } finally {
      setProcessing(false)
    }
  }

  const saldo = Number(installment?.amount || 0) - Number(installment?.amountPaid || 0)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Receber Parcela">
      <div className="space-y-6">
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">Parcela: {installmentLabel}</p>
          <p className="font-bold text-lg">{clientName}</p>
          <div className="flex justify-between mt-2 text-sm">
            <span>Valor Original: {formatCurrency(installment?.amount, isVisible('receivable_installment_value'))}</span>
            <span className="font-bold text-emerald-600">
              Saldo: {formatCurrency(saldo, isVisible('receivable_installment_balance'))}
            </span>
          </div>
        </div>

        {history.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-700">Histórico de Pagamentos</h3>
            <div className="bg-slate-50 rounded-lg divide-y divide-slate-200">
              {history.map((p) => (
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
            <CurrencyInput value={amount} onChange={setAmount} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Conta</label>
            <select value={account} onChange={(e) => setAccount(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20">
              <option value="">Selecione uma conta</option>
              {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Pagamento</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20">
              <option value="">Selecione a forma</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20">
              <option value="">Selecione uma categoria</option>
              {financialCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20" />
          </div>
          <button
            className="w-full bg-emerald-600 text-white p-3 rounded-lg font-bold hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!account || !category || !method || processing}
            onClick={handleConfirm}
          >
            {processing ? 'Processando...' : 'Confirmar Recebimento'}
          </button>
        </div>
      </div>
    </Modal>
  )
})

'use client'

import React, { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'react-hot-toast'

interface ContractStatementModalProps {
  isOpen: boolean
  onClose: () => void
  contractId: number
  contractTitle: string
}

export function ContractStatementModal({ isOpen, onClose, contractId, contractTitle }: ContractStatementModalProps) {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && contractId) {
      fetchPayments()
    }
  }, [isOpen, contractId])

  const fetchPayments = async () => {
    setLoading(true)

    // 1. Busca todas as parcelas do contrato
    const { data: installments, error: instError } = await supabase
      .from('installments')
      .select('id, installmentNumber')
      .eq('contract_id', contractId)

    if (instError) {
      toast.error('Erro ao buscar parcelas')
      console.error('Erro installments:', instError)
      setLoading(false)
      return
    }

    const installmentIds = installments?.map(i => i.id) || []
    console.log('Installment IDs found:', installmentIds)

    // 2. Busca pagamentos para essas parcelas
    const { data: payments, error: payError } = await supabase
      .from('payments')
      .select(`
        *, 
        financial_categories(name)
      `)
      .in('installment_id', installmentIds)
      .order('payment_date', { ascending: false })

    if (payError) {
      toast.error('Erro ao buscar pagamentos')
      console.error('Erro payments:', payError)
      setLoading(false)
      return
    }

    console.log('Payments found:', payments)

    // 3. Mapeia e junta
    const mappedPayments = (payments || []).map(p => ({
      ...p,
      installments: installments.find(i => i.id === p.installment_id)
    }))

    setPayments(mappedPayments)
    setLoading(false)
  }

  const totalReceived = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
  const uniqueInstallments = new Set(payments.map(p => p.installments?.installmentNumber)).size

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Extrato de Recebimentos">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Detalhes do Extrato</p>
          <button 
            onClick={() => toast.success('Funcionalidade de exportação em desenvolvimento')}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        </div>
        <div className="bg-white border-b border-slate-100 pb-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Contrato / Cliente</p>
          <p className="font-bold text-slate-900">{contractTitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <p className="text-xs text-emerald-600 font-medium">Total Recebido</p>
            <p className="text-xl font-bold text-emerald-900">{formatCurrency(totalReceived)}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-600 font-medium">Parcelas Pagas</p>
            <p className="text-xl font-bold text-slate-900">{uniqueInstallments}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-center p-4 text-slate-500">Carregando histórico...</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-3 text-left">Data</th>
                    <th className="p-3 text-left">Parcela</th>
                    <th className="p-3 text-left">Categoria</th>
                    <th className="p-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-600">{formatDate(p.payment_date)}</td>
                      <td className="p-3 font-medium text-slate-900">{p.installments?.installmentNumber || '-'}</td>
                      <td className="p-3 text-slate-600">{p.financial_categories?.name || '-'}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">Nenhum pagamento registrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { FileText } from 'lucide-react'

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
    const { data, error } = await supabase
      .from('payments')
      .select('*, installments!inner(contract_id, installmentNumber), bank_accounts(name), financial_categories(name)')
      .eq('installments.contract_id', contractId)
      .order('payment_date', { ascending: false })

    if (error) {
      toast.error('Erro ao buscar extrato de pagamentos')
      console.error(error)
    } else {
      setPayments(data || [])
    }
    setLoading(false)
  }

  const totalReceived = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Extrato de Recebimentos">
      <div className="space-y-6">
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">Extrato Consolidado</p>
          <p className="font-bold text-lg">{contractTitle}</p>
        </div>

        {loading ? (
          <p className="text-center p-4">Carregando histórico...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs">
                  <tr>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Parcela</th>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2">{formatDate(p.payment_date)}</td>
                      <td className="p-2">{p.installments?.installmentNumber}</td>
                      <td className="p-2">{p.financial_categories?.name || '-'}</td>
                      <td className="p-2 text-right font-medium text-emerald-600">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">Nenhum pagamento encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end p-4 border-t">
              <span className="text-lg font-bold">Total Recebido: {formatCurrency(totalReceived)}</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'

interface Props {
  isOpen: boolean
  onClose: () => void
  installmentId: number
  installmentLabel: string
  clientName?: string
  bankAccounts: any[]
  collapseMode: boolean
  collapseCount: number
  userId?: string | number | null
  onSuccess: () => void
}

export const ReverseInstallmentModal = React.memo(function ReverseInstallmentModal({
  isOpen,
  onClose,
  installmentId,
  installmentLabel,
  clientName,
  bankAccounts,
  collapseMode,
  collapseCount,
  userId,
  onSuccess,
}: Props) {
  // O estado fica dentro do modal: digitar não re-renderiza a página de
  // contratos/parcelas, que é pesada. A página só é avisada no sucesso.
  const [reason, setReason] = useState('')
  const [accountId, setAccountId] = useState('')
  const [processing, setProcessing] = useState(false)

  const handleClose = () => {
    setReason('')
    setAccountId('')
    setProcessing(false)
    onClose()
  }

  const handleConfirm = async () => {
    if (processing || !reason || !accountId) return
    setProcessing(true)
    try {
      const { error } = await supabase.rpc(
        collapseMode ? 'process_installment_estorno_colapso' : 'process_installment_estorno',
        {
          p_installment_id: installmentId,
          p_reason: reason,
          p_account_id: Number(accountId),
          p_user_id: userId || null,
        }
      )
      if (error) {
        toast.error(error.message || 'Erro ao estornar parcela')
        console.error(error)
        return
      }
      toast.success(
        collapseMode
          ? 'Desdobramento desfeito e subparcelas reabsorvidas!'
          : 'Parcela estornada com sucesso!'
      )
      setReason('')
      setAccountId('')
      onSuccess()
      handleClose()
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={collapseMode ? 'Desfazer Desdobramento' : 'Estornar Parcela'}
    >
      <div className="space-y-4">
        <p>Parcela: {installmentLabel} - {clientName}</p>

        {collapseMode && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            Esta ação desfaz o desdobramento: estorna o valor recebido nesta parcela e
            <b> reabsorve {collapseCount} subparcela(s)</b>. As linhas serão marcadas como
            <b> Reabsorvida</b>, desvinculadas da árvore e ocultas da tela; a parcela volta a
            dever o valor original.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Motivo do Estorno *</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
            placeholder="Ex: Pagamento devolvido"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Conta Bancária (para onde o valor volta) *
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
          >
            <option value="">Selecione uma conta...</option>
            {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <button
          className="w-full bg-rose-600 text-white p-2 rounded-lg disabled:opacity-50"
          disabled={!reason || !accountId || processing}
          onClick={handleConfirm}
        >
          {processing
            ? 'Processando...'
            : collapseMode
              ? 'Confirmar desdobramento'
              : 'Confirmar Estorno'}
        </button>
      </div>
    </Modal>
  )
})

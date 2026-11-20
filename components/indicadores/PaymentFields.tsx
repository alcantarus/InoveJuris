'use client'

import React, { useState } from 'react'

const paymentValueFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
})

function formatCurrencyMask(value: string): string {
  const numericValue = value.replace(/\D/g, '')
  const floatValue = parseFloat(numericValue) / 100
  return isNaN(floatValue) ? '0,00' : paymentValueFormatter.format(floatValue)
}

interface PaymentFieldsProps {
  contractId: number
  mobile?: boolean
  onPay: (contractId: number, value: string, description: string) => void
}

function PaymentFieldsInner({ contractId, mobile, onPay }: PaymentFieldsProps) {
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')

  return (
    <div className={mobile ? 'flex flex-col gap-2' : 'flex flex-col gap-2'}>
      <input
        type="text"
        placeholder="R$ 0,00"
        className={mobile ? 'w-full min-h-[40px] px-2 py-2 border rounded text-sm' : 'w-32 px-2 py-1 border rounded'}
        value={value}
        onChange={(e) => setValue(formatCurrencyMask(e.target.value))}
      />
      <input
        type="text"
        placeholder="Descrição"
        className={mobile ? 'w-full min-h-[40px] px-2 py-2 border rounded text-xs' : 'w-32 px-2 py-1 border rounded text-xs'}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button
        className={mobile ? 'w-full min-h-[40px] px-3 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700' : 'px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700'}
        onClick={() => onPay(contractId, value, description)}
      >
        Pagar
      </button>
    </div>
  )
}

export const PaymentFields = React.memo(PaymentFieldsInner)

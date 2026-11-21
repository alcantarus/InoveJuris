'use client'

import React, { useState } from 'react'
import { Check, Copy, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContractNumberBadgeProps {
  contractNumber?: string | number | null
  processNumber?: string | null
  contractId?: string | number | null
  className?: string
  showProcess?: boolean
}

/**
 * Identificação visual do contrato, reutilizável em todas as telas.
 * Prioriza `contractNumber`; quando ausente (ex.: ambiente de teste), usa o `id`.
 */
export function ContractNumberBadge({
  contractNumber,
  processNumber,
  contractId,
  className,
  showProcess = true,
}: ContractNumberBadgeProps) {
  const [copied, setCopied] = useState(false)

  const rawNumber = String(contractNumber ?? '').trim()
  const fallback = contractId !== null && contractId !== undefined && String(contractId).trim() !== ''
    ? `#${contractId}`
    : ''
  const primary = rawNumber || fallback
  const process = String(processNumber ?? '').trim()

  if (!primary && (!showProcess || !process)) return null

  const copyValue = rawNumber || String(contractId ?? '')
  const display = primary.startsWith('#') ? primary : `Nº ${primary}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // Área de transferência indisponível: apenas não interrompe a interface.
    }
  }

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5 align-middle no-underline', className)}>
      {primary && (
        <span
          className="group inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 px-2 py-1 text-[11px] font-bold leading-none tracking-wide text-white shadow-sm ring-1 ring-inset ring-white/20"
          title={`Número do contrato: ${copyValue}`}
        >
          <Hash className="h-3 w-3 opacity-80" strokeWidth={2.5} />
          <span>{display}</span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copiar número do contrato"
            className="ml-0.5 rounded p-0.5 text-white/70 opacity-0 transition hover:bg-white/20 hover:text-white focus:opacity-100 group-hover:opacity-100"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </span>
      )}
      {showProcess && process && (
        <span
          className="inline-flex items-center rounded-md border border-purple-100 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-tight text-purple-700"
          title={`Processo: ${process}`}
        >
          Proc. {process}
        </span>
      )}
    </span>
  )
}

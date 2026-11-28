'use client'

import React from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const tokens = (className ?? '').split(/\s+/).filter(Boolean)

  // Extract z-index from className if present, default to z-50
  const zIndexClass = tokens.find(c => /^z-(?:\[\d+\]|\d+)$/.test(c)) ?? 'z-50'

  // No mobile o modal deve sempre caber na tela. Larguras máximas vindas do
  // chamador (max-w-2xl etc.) só valem a partir do breakpoint sm.
  const extraClasses = tokens
    .filter(c => !/^z-(?:\[\d+\]|\d+)$/.test(c))
    .map(c => c.startsWith('max-w-') ? `sm:${c}` : c)
    .join(' ')

  // Modais sem largura declarada pelo chamador recebem um limite padrão,
  // evitando que ocupem a largura inteira do monitor no desktop.
  const hasExplicitMaxWidth = tokens.some(c => c.startsWith('max-w-'))
  const defaultMaxWidth = hasExplicitMaxWidth ? '' : 'sm:max-w-3xl'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={cn("fixed inset-0 bg-black/50 backdrop-blur-sm", zIndexClass)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "fixed inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 top-[max(0.75rem,env(safe-area-inset-top))] sm:top-1/2 sm:-translate-y-1/2 w-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:max-h-[85dvh]",
              zIndexClass,
              defaultMaxWidth,
              extraClasses
            )}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 pr-2 leading-tight break-words">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))] min-w-0">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

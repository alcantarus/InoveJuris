'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { Gift, ImageIcon, Printer, PartyPopper, MessageCircle } from 'lucide-react'
import { BirthdayCardGenerator } from '../BirthdayCardGenerator'
import { getBirthdays, type BirthdayPerson } from '@/lib/birthdays'
import { motion, AnimatePresence } from 'motion/react'
import confetti from 'canvas-confetti'
import { cn } from '@/lib/utils'

export default function BirthdayWidget() {
  const { user } = useAuth()
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([])
  const [sentCards, setSentCards] = useState<string[]>([])
  const [generatedCards, setGeneratedCards] = useState<string[]>([])
  const [selectedClient, setSelectedClient] = useState<BirthdayPerson | null>(null)
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const checkBirthdays = useCallback(async () => {
    if (!user) return

    try {
      const allBirthdays = await getBirthdays()
      setBirthdays(allBirthdays)
      
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const localSentStr = localStorage.getItem(`sent_birthdays_${todayStr}`)
      const localSent: string[] = localSentStr ? JSON.parse(localSentStr) : []
      setSentCards(localSent)

      const localGeneratedStr = localStorage.getItem(`generated_birthdays_${todayStr}`)
      if (localGeneratedStr) {
        setGeneratedCards(JSON.parse(localGeneratedStr))
      }
    } catch (error) {
      console.error('Erro ao verificar aniversariantes:', error)
    }
  }, [user])

  useEffect(() => {
    checkBirthdays()
  }, [checkBirthdays])

  // Celebração: confete contido no card enquanto ele estiver visível.
  // Dispara um estouro inicial e mantém um gotejo suave para deixar claro
  // que hoje há aniversariante. Respeita "reduzir movimento".
  useEffect(() => {
    if (birthdays.length === 0) return

    const canvas = confettiCanvasRef.current
    const card = cardRef.current
    if (!canvas || !card) return

    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    // Sem worker: mais compatível entre navegadores e suficiente para o card.
    const celebrate = confetti.create(canvas, { resize: true })
    const colors = ['#6366f1', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981']
    let interval: number | undefined

    const burst = (strong: boolean) => {
      celebrate({
        particleCount: strong ? 70 : 16,
        spread: strong ? 70 : 55,
        startVelocity: strong ? 28 : 20,
        gravity: 0.85,
        scalar: strong ? 0.9 : 0.75,
        ticks: strong ? 150 : 110,
        origin: { x: 0.5, y: 0.3 },
        colors,
      })
      if (!strong) return
      // Estouros laterais dão volume ao primeiro impacto.
      celebrate({
        particleCount: 24,
        angle: 60,
        spread: 55,
        startVelocity: 30,
        origin: { x: 0, y: 0.6 },
        colors,
      })
      celebrate({
        particleCount: 24,
        angle: 120,
        spread: 55,
        startVelocity: 30,
        origin: { x: 1, y: 0.6 },
        colors,
      })
    }

    const start = () => {
      if (interval !== undefined) return
      burst(true)
      interval = window.setInterval(() => burst(false), 3000)
    }

    const stop = () => {
      if (interval === undefined) return
      window.clearInterval(interval)
      interval = undefined
    }

    if (typeof IntersectionObserver === 'undefined') {
      start()
      return () => {
        stop()
        celebrate.reset()
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) start()
        else stop()
      },
      { threshold: 0.15 }
    )

    observer.observe(card)

    // Pausa quando a aba perde o foco e retoma se o card continua visível.
    const handleVisibility = () => {
      if (document.hidden) {
        stop()
        return
      }
      const rect = card.getBoundingClientRect()
      if (rect.bottom > 0 && rect.top < window.innerHeight) start()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      stop()
      celebrate.reset()
    }
  }, [birthdays.length])

  const pendingBirthdays = birthdays.filter(b => !sentCards.includes(b.id))

  const handleCardGenerated = async (clientId: string) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    const newGenerated = [...new Set([...generatedCards, clientId])]
    setGeneratedCards(newGenerated)
    localStorage.setItem(`generated_birthdays_${todayStr}`, JSON.stringify(newGenerated))
    
    const newSent = [...new Set([...sentCards, clientId])]
    setSentCards(newSent)
    localStorage.setItem(`sent_birthdays_${todayStr}`, JSON.stringify(newSent))
    
    // O log de marketing é gravado pelo BirthdayCardGenerator (fonte única).
    setSelectedClient(null)
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
  }

  if (birthdays.length === 0) return null

  return (
    <div ref={cardRef} className="relative overflow-hidden bg-gradient-to-br from-white via-white to-indigo-50/70 p-6 rounded-3xl border border-indigo-100 shadow-sm ring-1 ring-indigo-100/60">
      {/* Confete contido no card (disparo único ao abrir). */}
      <canvas
        ref={confettiCanvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      />

      <div className="relative z-10 flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <PartyPopper className="text-indigo-600" />
          Aniversariantes de Hoje
        </h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
            <PartyPopper className="h-3.5 w-3.5" />
            Hoje!
          </span>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">
            {birthdays.length}
          </span>
        </div>
      </div>
      
      <div className="relative z-10 space-y-4">
        {birthdays.map((client) => (
          <div
            key={client.id}
            className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl"
          >
            <div className="flex items-center gap-3 min-w-0 flex-grow">
              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {client.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-grow">
                <h4 className="font-semibold text-slate-900 text-sm leading-tight truncate">{client.name}</h4>
                <p className="text-xs text-slate-500 truncate">🎉 {client.age} anos</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setSelectedClient(client)}
                title={generatedCards.includes(client.id) ? 'Reemitir Cartão' : 'Gerar Cartão'}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  generatedCards.includes(client.id) 
                    ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                    : "text-white bg-indigo-600 hover:bg-indigo-700"
                )}
              >
                {generatedCards.includes(client.id) ? <Printer className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
              </button>
              <a
                href={client.phone ? `https://wa.me/55${client.phone.replace(/\D/g, '')}?text=Parabéns, ${client.name}! A InoveJuris deseja um feliz aniversário!` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                title={client.phone ? "Enviar WhatsApp" : "Telefone não disponível"}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  client.phone 
                    ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                    : "text-slate-400 bg-slate-100 cursor-not-allowed"
                )}
                onClick={(e) => !client.phone && e.preventDefault()}
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedClient && (
          <BirthdayCardGenerator
            clientName={selectedClient.name}
            clientId={selectedClient.id}
            onClose={() => setSelectedClient(null)}
            onSuccess={handleCardGenerated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

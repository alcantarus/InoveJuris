'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Gift, X, ChevronRight, Image as ImageIcon, CheckCircle2, Calendar, Sparkles, PartyPopper, Printer } from 'lucide-react'
import { BirthdayCardGenerator } from './BirthdayCardGenerator'
import { getBirthdays, invalidateBirthdaysCache, type BirthdayPerson } from '@/lib/birthdays'
import { motion, AnimatePresence } from 'motion/react'
import confetti from 'canvas-confetti'

export function BirthdayChecker({ className = '' }: { className?: string }) {
  const { user } = useAuth()
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([])
  const [sentCards, setSentCards] = useState<string[]>([])
  const [generatedCards, setGeneratedCards] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<BirthdayPerson | null>(null)
  const [hasChecked, setHasChecked] = useState(false)

  const [showCompleted, setShowCompleted] = useState(false)

  const checkBirthdays = useCallback(async () => {
    if (!user) return

    try {
      const allBirthdays = await getBirthdays()
      setBirthdays(allBirthdays)
      
      // Carrega os cartões já enviados hoje
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      
      const { data: logs, error: logError } = await supabase
        .from('marketing_logs')
        .select('client_id, type')
        .in('type', ['birthday_card', 'birthday_card_client', 'birthday_card_indicator', 'birthday_card_maternity', 'maternity_card'])
        .gte('created_at', todayStart.toISOString())

      if (logError) {
        console.error('Erro ao buscar logs de marketing:', logError)
      }

      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const localSentStr = localStorage.getItem(`sent_birthdays_${todayStr}`)
      const localSent: string[] = localSentStr ? JSON.parse(localSentStr) : []

      if (!logError && logs) {
        const dbSent = logs.map((l: any) => {
          if (l.type === 'birthday_card_indicator') return `indicator_${l.client_id}`
          if (l.type === 'birthday_card_client') return `client_${l.client_id}`
          if (l.type === 'birthday_card_maternity' || l.type === 'maternity_card') return `maternity_${l.client_id}`
          // Fallback for old records if any
          return `client_${l.client_id}`
        })
        
        // Merge DB and LocalStorage to prevent flickering
        const mergedSent = Array.from(new Set([...dbSent, ...localSent]))
        setSentCards(mergedSent)
      } else {
        setSentCards(localSent)
      }
      
      setHasChecked(true)
    } catch (error) {
      console.error('Erro crítico ao verificar aniversariantes:', error instanceof Error ? error.message : JSON.stringify(error))
    }
  }, [user])

  const pendingBirthdays = birthdays.filter(b => !sentCards.includes(b.id))
  const completedBirthdays = birthdays.filter(b => sentCards.includes(b.id))

  // Verifica ao montar e ao focar na janela
  useEffect(() => {
    checkBirthdays()

    const handleFocus = () => {
      // Preserva o comportamento original de revalidar ao focar a janela,
      // mas sem refetch em cada mount (o cache compartilhado evita as 3
      // consultas duplicadas por componente no dashboard).
      invalidateBirthdaysCache()
      checkBirthdays()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [checkBirthdays])

  const handleCardGenerated = async (clientId: string) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    // Adiciona aos gerados para permitir reimpressão
    const newGenerated = [...generatedCards, clientId]
    setGeneratedCards(newGenerated)
    localStorage.setItem(`generated_birthdays_${todayStr}`, JSON.stringify(newGenerated))
    
    // Mantém a lógica existente para sentCards
    const newSent = [...sentCards, clientId]
    setSentCards(newSent)
    localStorage.setItem(`sent_birthdays_${todayStr}`, JSON.stringify(newSent))
    
    // O log de marketing é gravado pelo BirthdayCardGenerator (fonte única).
    setSelectedClient(null)
  }

  const [todayString, setTodayString] = useState('')
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const triggerCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    setTodayString(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
    
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const localGeneratedStr = localStorage.getItem(`generated_birthdays_${todayStr}`)
    if (localGeneratedStr) {
      setGeneratedCards(JSON.parse(localGeneratedStr))
    }
  }, [])

  // Confete contínuo na pílula enquanto ela estiver visível. A pílula é
  // pequena, então os estouros são curtos e leves para não atrapalhar o clique.
  useEffect(() => {
    if (!hasChecked || birthdays.length === 0 || isOpen) return

    const trigger = triggerRef.current
    const canvas = triggerCanvasRef.current
    if (!trigger || !canvas) return

    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    const celebrate = confetti.create(canvas, { resize: true })
    const colors = ['#6366f1', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981']
    let interval: number | undefined

    const burst = () => {
      celebrate({
        particleCount: 12,
        spread: 70,
        startVelocity: 14,
        gravity: 0.4,
        scalar: 0.45,
        ticks: 90,
        origin: { x: 0.5, y: 0.55 },
        colors,
      })
    }

    const start = () => {
      if (interval !== undefined) return
      burst()
      interval = window.setInterval(burst, 2200)
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
      { threshold: 0.5 }
    )
    observer.observe(trigger)

    const handleVisibility = () => {
      if (document.hidden) {
        stop()
        return
      }
      const rect = trigger.getBoundingClientRect()
      if (rect.bottom > 0 && rect.top < window.innerHeight) start()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      stop()
      celebrate.reset()
    }
  }, [hasChecked, birthdays.length, isOpen])

  if (!hasChecked || birthdays.length === 0) return null

  return (
    <>
      {/* Gatilho discreto no fluxo do documento: nunca sobrepõe as ações
          do cabeçalho, como o botão "Gerar Insights". */}
      {!isOpen && (
        <button
          type="button"
          ref={triggerRef}
          onClick={() => setIsOpen(true)}
          title="Ver aniversariantes de hoje"
          aria-label={`Aniversariantes de hoje: ${pendingBirthdays.length} pendente(s)`}
          className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-slate-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 ${className}`}
        >
          <canvas
            ref={triggerCanvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
          />
          <span className="relative z-10 inline-flex items-center gap-1.5">
            <Gift className="h-4 w-4" />
            <span className="text-xs font-medium">Aniversariantes</span>
            {pendingBirthdays.length > 0 && (
              <span className="ml-0.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                {pendingBirthdays.length}
              </span>
            )}
          </span>
        </button>
      )}

      {/* Modal de Lista */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] relative z-10"
            >
              {/* Header com gradiente */}
              <div className="relative bg-gradient-to-br from-indigo-600 to-violet-700 px-6 py-6 text-white overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Gift size={120} />
                </div>
                
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
                      Aniversariantes
                      <button 
                        onClick={() => confetti({
                          particleCount: 100,
                          spread: 70,
                          origin: { y: 0.3 },
                          colors: ['#ffffff', '#fbbf24', '#f472b6']
                        })}
                        className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                        title="Celebrar!"
                      >
                        <PartyPopper className="w-4 h-4 text-yellow-300" />
                      </button>
                    </h3>
                    <p className="text-indigo-100 text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {todayString}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                <div className="space-y-4">
                  {/* Pendentes */}
                  {pendingBirthdays.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Pendentes ({pendingBirthdays.length})
                      </h4>
                      <AnimatePresence>
                        {pendingBirthdays.map((client) => (
                          <motion.div
                            key={client.id}
                            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.9 }}
                            className="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all overflow-hidden cursor-pointer"
                            onClick={() => {
                              console.log('Clicou em Gerar Card para:', client.name);
                              setSelectedClient(client);
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                {(client.name || 'C').charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">{client.name}</h4>
                                <p className="text-sm text-slate-500 font-medium">🎉 {client.age} anos</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 min-w-[120px] justify-end">
                              {generatedCards.includes(client.id) ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedClient(client);
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm"
                                  title="Reimprimir"
                                >
                                  <Printer className="w-4 h-4" />
                                  Reimprimir
                                </button>
                              ) : (
                                <button
                                  onClick={() => setSelectedClient(client)}
                                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                                >
                                  <ImageIcon className="w-4 h-4" />
                                  Gerar Card
                                </button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 mb-1">Tudo certo por hoje!</h4>
                      <p className="text-sm text-slate-500">Todos os cartões de aniversário foram enviados.</p>
                    </div>
                  )}

                  {/* Concluídos */}
                  {completedBirthdays.length > 0 && (
                    <div className="pt-4 border-t border-slate-200 mt-4">
                      <button 
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="w-full flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                      >
                        <span className="text-sm font-semibold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Ver {completedBirthdays.length} {completedBirthdays.length === 1 ? 'cartão enviado' : 'cartões enviados'} hoje
                        </span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${showCompleted ? 'rotate-90' : ''}`} />
                      </button>
                      
                      <AnimatePresence>
                        {showCompleted && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-3 pt-3">
                              {completedBirthdays.map((client) => (
                                <div
                                  key={client.id}
                                  className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl opacity-80 hover:opacity-100 transition-all"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-lg">
                                      {(client.name || 'C').charAt(0)}
                                    </div>
                                    <div>
                                      <h4 className="font-medium text-slate-700">{client.name}</h4>
                                      <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold mt-0.5">
                                        <CheckCircle2 className="w-3 h-3" />
                                        ENVIADO
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => setSelectedClient(client)}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                    title="Gerar novamente"
                                  >
                                    <ImageIcon className="w-3 h-3" />
                                    Reemitir
                                  </button>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal do Gerador de Cartão */}
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
    </>
  )
}

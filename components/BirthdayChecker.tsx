'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Gift, X, ChevronRight, Image as ImageIcon, CheckCircle2, Calendar, Sparkles, PartyPopper, Printer } from 'lucide-react'
import { BirthdayCardGenerator } from './BirthdayCardGenerator'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

interface BirthdayPerson {
  id: string
  name: string
  birthDate: string
  age: number
  type: 'client' | 'indicator'
}

export function BirthdayChecker() {
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
      const [clientsRes, indicatorsRes, maternityRes] = await Promise.all([
        supabase.from('clients').select('id, name, "birthDate"').not('"birthDate"', 'is', null),
        supabase.from('indicators').select('id, name, data_nascimento').not('data_nascimento', 'is', null),
        supabase.from('contracts').select('id, maternity_child_name, maternity_birth_date').eq('product', 'Salário-Maternidade').not('maternity_birth_date', 'is', null)
      ])
      
      if (clientsRes.error) throw clientsRes.error
      if (indicatorsRes.error) throw indicatorsRes.error
      if (maternityRes.error) throw maternityRes.error

      const todayDate = new Date()
      const currentMonth = todayDate.getMonth() + 1
      const currentDay = todayDate.getDate()
      const currentYear = todayDate.getFullYear()

      const processBirthday = (person: any, dateField: string, type: 'client' | 'indicator') => {
        const birthDate = person[dateField]
        if (!birthDate) return null
        
        let dateObj: Date
        let birthYear: number
        
        if (birthDate.includes('-')) {
          const [year, month, day] = birthDate.split('-').map(Number)
          dateObj = new Date(year, month - 1, day)
          birthYear = year
        } else if (birthDate.includes('/')) {
          const [day, month, year] = birthDate.split('/').map(Number)
          dateObj = new Date(year, month - 1, day)
          birthYear = year
        } else {
          dateObj = new Date(birthDate)
          birthYear = dateObj.getFullYear()
        }
        
        if ((dateObj.getMonth() + 1) === currentMonth && dateObj.getDate() === currentDay) {
          return {
            id: `${type}_${person.id}`,
            name: person.name,
            birthDate: birthDate,
            age: currentYear - birthYear,
            type
          }
        }
        return null
      }

      const processMaternity = (contract: any) => {
        const birthDate = contract.maternity_birth_date
        if (!birthDate) return null
        
        let dateObj: Date
        
        if (birthDate.includes('-')) {
          const [year, month, day] = birthDate.split('-').map(Number)
          dateObj = new Date(year, month - 1, day)
        } else if (birthDate.includes('/')) {
          const [day, month, year] = birthDate.split('/').map(Number)
          dateObj = new Date(year, month - 1, day)
        } else {
          dateObj = new Date(birthDate)
        }
        
        if ((dateObj.getMonth() + 1) === currentMonth && dateObj.getDate() === currentDay) {
          return {
            id: `maternity_${contract.id}`,
            name: contract.maternity_child_name,
            birthDate: birthDate,
            age: 0, // Recém-nascido
            type: 'maternity'
          }
        }
        return null
      }

      const birthdayClients = (clientsRes.data || []).map((c: any) => processBirthday(c, 'birthDate', 'client')).filter(Boolean) as BirthdayPerson[]
      const birthdayIndicators = (indicatorsRes.data || []).map((i: any) => processBirthday(i, 'data_nascimento', 'indicator')).filter(Boolean) as BirthdayPerson[]
      const maternityBirths = (maternityRes.data || []).map((c: any) => processMaternity(c)).filter(Boolean) as BirthdayPerson[]
      
      const allBirthdays = [...birthdayClients, ...birthdayIndicators, ...maternityBirths] as BirthdayPerson[]
      
      setBirthdays(allBirthdays)
      console.log('Eventos encontrados:', allBirthdays)
      
      // Carrega os cartões já enviados hoje
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      
      const { data: logs, error: logError } = await supabase
        .from('marketing_logs')
        .select('client_id, type')
        .in('type', ['birthday_card', 'birthday_card_client', 'birthday_card_indicator', 'maternity_card'])
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
          if (l.type === 'maternity_card') return `maternity_${l.client_id}`
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
      checkBirthdays()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [checkBirthdays])

  // Confetti ao abrir
  useEffect(() => {
    if (isOpen && pendingBirthdays.length > 0) {
      const timer = setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#4f46e5', '#8b5cf6', '#ec4899']
        })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, pendingBirthdays.length])

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
    
    // Salva o log no Supabase
    try {
      const type = clientId.startsWith('indicator_') ? 'birthday_card_indicator' : 
                   clientId.startsWith('maternity_') ? 'maternity_card' : 'birthday_card_client'
      const numericId = parseInt(clientId.replace(/\D/g, ''), 10)
      
      await supabase.from('marketing_logs').insert([{
        client_id: numericId,
        type: type
      }])
    } catch (e) {
      console.error('Erro ao salvar log no Supabase:', e)
    }
    
    setSelectedClient(null)
  }

  const [todayString, setTodayString] = useState('')

  useEffect(() => {
    setTodayString(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
    
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const localGeneratedStr = localStorage.getItem(`generated_birthdays_${todayStr}`)
    if (localGeneratedStr) {
      setGeneratedCards(JSON.parse(localGeneratedStr))
    }
  }, [])

  if (!hasChecked || birthdays.length === 0) return null

  return (
    <>
      {/* Floating Badge */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed top-20 right-6 z-40"
          >
            <button
              onClick={() => setIsOpen(true)}
              className={`relative flex items-center justify-center rounded-full shadow-lg transition-all transform hover:scale-105 group ${
                pendingBirthdays.length > 0 
                  ? 'gap-3 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-500/30 hover:shadow-indigo-500/50' 
                  : 'w-12 h-12 bg-white text-slate-400 border border-slate-200 shadow-slate-200/50 hover:text-indigo-600'
              }`}
            >
              {pendingBirthdays.length > 0 && (
                <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                  {pendingBirthdays.length}
                </div>
              )}
              <Gift className={`w-5 h-5 ${pendingBirthdays.length > 0 ? 'animate-pulse' : ''}`} />
              {pendingBirthdays.length > 0 && (
                <span className="font-medium text-sm pr-1">Aniversariantes Hoje!</span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
                                {client.name.charAt(0)}
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
                                      {client.name.charAt(0)}
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

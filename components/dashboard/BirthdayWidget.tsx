'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Gift, ImageIcon, Printer, PartyPopper, MessageCircle } from 'lucide-react'
import { BirthdayCardGenerator } from '../BirthdayCardGenerator'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { cn } from '@/lib/utils'

interface BirthdayPerson {
  id: string
  name: string
  birthDate: string
  age: number
  type: 'client' | 'indicator'
  phone?: string
}

export default function BirthdayWidget() {
  const { user } = useAuth()
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([])
  const [sentCards, setSentCards] = useState<string[]>([])
  const [generatedCards, setGeneratedCards] = useState<string[]>([])
  const [selectedClient, setSelectedClient] = useState<BirthdayPerson | null>(null)

  const checkBirthdays = useCallback(async () => {
    if (!user) return

    try {
      const [clientsRes, indicatorsRes] = await Promise.all([
        supabase.from('clients').select('id, name, "birthDate", phone').not('"birthDate"', 'is', null),
        supabase.from('indicators').select('id, name, data_nascimento, phone').not('data_nascimento', 'is', null)
      ])
      
      if (clientsRes.error) throw clientsRes.error
      if (indicatorsRes.error) throw indicatorsRes.error

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
            type,
            phone: person.phone
          }
        }
        return null
      }

      const birthdayClients = (clientsRes.data || []).map((c: any) => processBirthday(c, 'birthDate', 'client')).filter(Boolean) as BirthdayPerson[]
      const birthdayIndicators = (indicatorsRes.data || []).map((i: any) => processBirthday(i, 'data_nascimento', 'indicator')).filter(Boolean) as BirthdayPerson[]
      
      const allBirthdays = [...birthdayClients, ...birthdayIndicators] as BirthdayPerson[]
      
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

  const pendingBirthdays = birthdays.filter(b => !sentCards.includes(b.id))

  const handleCardGenerated = (clientId: string) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    const newGenerated = [...new Set([...generatedCards, clientId])]
    setGeneratedCards(newGenerated)
    localStorage.setItem(`generated_birthdays_${todayStr}`, JSON.stringify(newGenerated))
    
    const newSent = [...new Set([...sentCards, clientId])]
    setSentCards(newSent)
    localStorage.setItem(`sent_birthdays_${todayStr}`, JSON.stringify(newSent))
    
    setSelectedClient(null)
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
  }

  if (birthdays.length === 0) return null

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <PartyPopper className="text-indigo-600" />
          Aniversariantes de Hoje
        </h2>
        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">
          {birthdays.length}
        </span>
      </div>
      
      <div className="space-y-4">
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

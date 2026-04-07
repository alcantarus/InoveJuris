'use client'

import React, { useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { getTodayBR } from '@/lib/utils'

export function GPSNotificationChecker() {
  const { user } = useAuth()

  const checkGPSDueDates = useCallback(async () => {
    if (!user?.id) return

    try {
      // 1. Busca contratos com GPS vencendo hoje e não pagas
      const today = getTodayBR()
      
      const { data: contracts, error: contractsError } = await supabase
        .from('contracts')
        .select('id, gps_forecast_date, gpsPaid, clients(name)')
        .eq('gpsPaid', false)
        .eq('gps_forecast_date', today)
      
      if (contractsError) throw contractsError
      if (!contracts || contracts.length === 0) return

      // 2. Para cada contrato, verifica se já existe notificação para hoje
      for (const contract of contracts) {
        const clientName = (Array.isArray(contract.clients) ? contract.clients[0]?.name : (contract.clients as any)?.name) || 'Cliente Desconhecido'
        const title = 'Vencimento de GPS'
        const message = `Hoje está previsto o pagamento da GPS de ${clientName}.`

        // Verifica se já existe notificação para este contrato e data
        const { data: existingNotifications, error: checkError } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('title', title)
          .eq('message', message)
          .gte('created_at', getTodayBR())

        if (checkError) throw checkError
        
        if (!existingNotifications || existingNotifications.length === 0) {
          // 3. Insere notificação
          await supabase
            .from('notifications')
            .insert({
              title,
              message,
              type: 'warning',
              user_id: Number(user.id),
              is_read: false
            })
        }
      }
    } catch (error) {
      console.error('Erro ao verificar vencimentos de GPS:', error)
    }
  }, [user])

  useEffect(() => {
    checkGPSDueDates()

    const handleFocus = () => {
      checkGPSDueDates()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [checkGPSDueDates])

  return null
}

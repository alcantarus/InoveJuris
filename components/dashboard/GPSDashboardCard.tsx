'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function GPSDashboardCard() {
  const [counts, setCounts] = useState({ atrasado: 0, hoje: 0, d1_3: 0, d4_7: 0, d8_15: 0, d16_30: 0, d30plus: 0 })
  const router = useRouter()

  useEffect(() => {
    async function fetchCounts() {
      const { data: contracts, error } = await supabase
        .from('contracts')
        .select('gps_forecast_date')
        .eq('gpsPaid', false)
        .not('gps_forecast_date', 'is', null)
      
      if (error) {
        console.error('Erro ao buscar GPS:', error)
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const counts = { atrasado: 0, hoje: 0, d1_3: 0, d4_7: 0, d8_15: 0, d16_30: 0, d30plus: 0 }
      
      contracts?.forEach((c: { gps_forecast_date: string }) => {
        const forecast = new Date(c.gps_forecast_date)
        forecast.setHours(0, 0, 0, 0)
        
        const diffDays = Math.ceil((forecast.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diffDays < 0) counts.atrasado++
        else if (diffDays === 0) counts.hoje++
        else if (diffDays <= 3) counts.d1_3++
        else if (diffDays <= 7) counts.d4_7++
        else if (diffDays <= 15) counts.d8_15++
        else if (diffDays <= 30) counts.d16_30++
        else counts.d30plus++
      })
      
      setCounts(counts)
    }
    fetchCounts()
  }, [])

  const handleRedirect = () => {
    router.push('/relatorios?tab=gps')
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={handleRedirect}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
          <Calendar size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Previsão de Vencimento GPS</h3>
      </div>
      
      <div className="grid grid-cols-7 gap-2 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-rose-800">{counts.atrasado}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">Atrasado</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-rose-600">{counts.hoje}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">Hoje</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-orange-500">{counts.d1_3}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">1-3 dias</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-amber-500">{counts.d4_7}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">4-7 dias</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-yellow-500">{counts.d8_15}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">8-15 dias</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-blue-500">{counts.d16_30}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">16-30 dias</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-indigo-600">{counts.d30plus}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">30+ dias</span>
        </div>
      </div>
    </div>
  )
}

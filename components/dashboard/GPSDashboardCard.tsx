'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function GPSDashboardCard() {
  const [counts, setCounts] = useState({ today: 0, d3: 0, d7: 0, d15: 0, d30plus: 0 })
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
      
      const counts = { today: 0, d3: 0, d7: 0, d15: 0, d30plus: 0 }
      
      contracts?.forEach((c: { gps_forecast_date: string }) => {
        const forecast = new Date(c.gps_forecast_date)
        forecast.setHours(0, 0, 0, 0)
        
        const diffDays = Math.ceil((forecast.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diffDays <= 0) counts.today++
        else if (diffDays < 7) counts.d3++
        else if (diffDays < 15) counts.d7++
        else if (diffDays < 30) counts.d15++
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
      
      <div className="grid grid-cols-5 gap-2 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-rose-600">{counts.today}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">0 Dias</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-amber-600">{counts.d3}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">3+ Dias</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-yellow-600">{counts.d7}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">7+ Dias</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-blue-600">{counts.d15}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">15+ Dias</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-indigo-600">{counts.d30plus}</span>
          <span className="text-[9px] uppercase font-bold text-slate-500">30+ Dias</span>
        </div>
      </div>
    </div>
  )
}

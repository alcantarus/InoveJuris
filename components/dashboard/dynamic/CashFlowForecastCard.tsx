'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function CashFlowForecastCard() {
  const [forecast, setForecast] = useState(0)

  useEffect(() => {
    async function fetchForecast() {
      const { data, error } = await supabase
        .from('vw_cash_flow_forecast')
        .select('expected_amount')
      
      if (error) {
        console.error('Erro ao buscar previsão:', error)
        return
      }

      const totalForecast = (data || []).reduce((acc: number, curr: any) => acc + (curr.expected_amount || 0), 0)
      setForecast(totalForecast)
    }
    fetchForecast()
  }, [])

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-50 text-green-600 rounded-xl">
          <TrendingUp size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Previsão de Fluxo (30 dias)</h3>
      </div>
      <div className="text-3xl font-bold text-slate-900">{formatCurrency(forecast)}</div>
      <p className="text-sm text-slate-500">Receita esperada com probabilidade ajustada</p>
    </div>
  )
}

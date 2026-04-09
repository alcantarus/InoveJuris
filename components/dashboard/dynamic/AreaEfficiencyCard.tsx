'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart3 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function AreaEfficiencyCard() {
  const [efficiency, setEfficiency] = useState<any[]>([])

  useEffect(() => {
    async function fetchEfficiency() {
      const { data, error } = await supabase
        .from('vw_area_efficiency')
        .select('*')
      
      if (error) {
        console.error('Erro ao buscar eficiência:', error)
        return
      }

      setEfficiency(data)
    }
    fetchEfficiency()
  }, [])

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
          <BarChart3 size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Eficiência por Área</h3>
      </div>
      <div className="space-y-2">
        {efficiency.slice(0, 3).map((area, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="text-slate-600">{area.law_area}</span>
            <span className="font-bold text-slate-900">{formatCurrency(area.average_ticket)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Activity } from 'lucide-react'

export function ProcessVelocityCard() {
  const [velocity, setVelocity] = useState(0)

  useEffect(() => {
    async function fetchVelocity() {
      const { data, error } = await supabase
        .from('vw_process_velocity')
        .select('days_since_last_movement')
      
      if (error) {
        console.error('Erro ao buscar velocidade:', error)
        return
      }

      const avgVelocity = data.reduce((acc, curr) => acc + curr.days_since_last_movement, 0) / data.length
      setVelocity(avgVelocity)
    }
    fetchVelocity()
  }, [])

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
          <Activity size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Velocidade Processual</h3>
      </div>
      <div className="text-3xl font-bold text-slate-900">{velocity.toFixed(1)} dias</div>
      <p className="text-sm text-slate-500">Média de tempo desde a última movimentação</p>
    </div>
  )
}

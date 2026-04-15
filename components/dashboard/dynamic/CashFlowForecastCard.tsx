'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Modal } from '@/components/Modal'

export function CashFlowForecastCard() {
  const [forecast, setForecast] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<any[]>([])

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

  const fetchDetails = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vw_cash_flow_forecast')
      .select('*')
      .limit(10)
    
    if (!error) setDetails(data || [])
    setLoading(false)
  }

  return (
    <>
      <div 
        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all"
        onClick={() => { setIsModalOpen(true); fetchDetails(); }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-50 text-green-600 rounded-xl">
            <TrendingUp size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Previsão de Fluxo (30 dias)</h3>
        </div>
        <div className="text-3xl font-bold text-slate-900">{formatCurrency(forecast)}</div>
        <p className="text-sm text-slate-500">Receita esperada com probabilidade ajustada</p>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Previsão de Fluxo - Detalhes"
      >
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-green-600" size={32} /></div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Detalhamento da previsão de fluxo de caixa:</p>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {details.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg text-sm">
                  <span className="font-medium text-slate-900">{item.description || 'Receita Prevista'}</span>
                  <span className="font-bold text-green-600">{formatCurrency(item.expected_amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

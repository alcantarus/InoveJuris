'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart3, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Modal } from '@/components/Modal'

export function AreaEfficiencyCard() {
  const [efficiency, setEfficiency] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchEfficiency = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vw_area_efficiency')
      .select('*')
    
    if (error) {
      console.error('Erro ao buscar eficiência:', error)
    } else {
      setEfficiency(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchEfficiency()
  }, [])

  return (
    <>
      <div 
        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all"
        onClick={() => setIsModalOpen(true)}
      >
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Eficiência por Área - Detalhes"
      >
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-purple-600" size={32} /></div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Ticket médio por área de atuação:</p>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {efficiency.map((area, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg text-sm">
                  <span className="font-medium text-slate-900">{area.law_area}</span>
                  <span className="font-bold text-purple-600">{formatCurrency(area.average_ticket)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

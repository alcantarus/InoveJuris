import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Activity, Loader2 } from 'lucide-react'
import { Modal } from '@/components/Modal'

export function ProcessVelocityCard() {
  const [velocity, setVelocity] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<any[]>([])

  useEffect(() => {
    async function fetchVelocity() {
      const { data, error } = await supabase
        .from('vw_process_velocity')
        .select('days_since_last_movement')
      
      if (error) {
        console.error('Erro ao buscar velocidade:', error)
        return
      }

      const avgVelocity = (data || []).reduce((acc: number, curr: any) => acc + (curr.days_since_last_movement || 0), 0) / (data?.length || 1)
      setVelocity(avgVelocity)
    }
    fetchVelocity()
  }, [])

  const fetchDetails = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('processes')
      .select('number, client, status, last_update')
      .order('last_update', { ascending: true })
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
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <Activity size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Velocidade Processual</h3>
        </div>
        <div className="text-3xl font-bold text-slate-900">{velocity.toFixed(1)} dias</div>
        <p className="text-sm text-slate-500">Média de tempo desde a última movimentação</p>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Velocidade Processual - Detalhes"
      >
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Processos com maior tempo sem movimentação:</p>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {details.map((p: any) => (
                <div key={p.number} className="p-3 bg-slate-50 rounded-lg text-sm">
                  <p className="font-bold">{p.number} - {p.client}</p>
                  <p className="text-xs text-slate-500">Última atualização: {p.last_update ? new Date(p.last_update).toLocaleDateString() : 'Nunca'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

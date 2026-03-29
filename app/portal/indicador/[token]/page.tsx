'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'

export default function PortalIndicadorPage() {
  const { token } = useParams()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPortalData() {
      if (!token) return
      
      // 1. Get indicator_id from token
      const { data: tokenData, error: tokenError } = await supabase
        .from('indicator_tokens')
        .select('indicator_id, type, expires_at, is_active')
        .eq('token', token)
        .single()

      console.log('Token data:', tokenData, 'Error:', tokenError);

      if (tokenError || !tokenData) {
        setErrorMsg('Token inválido ou não encontrado.')
        setLoading(false)
        return
      }

      if (!tokenData.is_active) {
        setErrorMsg('Este link de acesso foi revogado pelo administrador.')
        setLoading(false)
        return
      }

      if (tokenData.type === 'temporary' && tokenData.expires_at) {
        const now = new Date()
        const expiresAt = new Date(tokenData.expires_at)
        if (now > expiresAt) {
          setErrorMsg('Este link de acesso expirou. Por favor, solicite um novo link ao administrador.')
          setLoading(false)
          return
        }
      }

      // 2. Get commission status
      const { data: statusData, error: statusError } = await supabase
        .from('vw_indicator_commission_status')
        .select('*')
        .eq('indicator_id', tokenData.indicator_id)

      console.log('Status data:', statusData, 'Error:', statusError);

      if (statusData) setData(statusData)
      setLoading(false)
    }

    fetchPortalData()
  }, [token])

  if (loading) return <div className="p-6">Carregando...</div>
  if (errorMsg) return <div className="p-6 text-red-600 font-medium">{errorMsg}</div>
  if (data.length === 0) return <div className="p-6">Nenhum dado encontrado.</div>

  const totalCommissions = data.reduce((acc, curr) => acc + Number(curr.total_commission), 0);
  const totalRemaining = data.reduce((acc, curr) => acc + Number(curr.remaining_balance), 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Portal do Indicador</h1>
      <h2 className="text-xl text-slate-600">{data[0].indicator_name}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Total de Comissões Geradas">
          <p className="text-3xl font-bold text-slate-900">R$ {totalCommissions.toFixed(2)}</p>
        </Card>
        <Card title="Total a Receber">
          <p className="text-3xl font-bold text-emerald-600">R$ {totalRemaining.toFixed(2)}</p>
        </Card>
      </div>

      <Card title="Minhas Comissões">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Contrato ID</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Total Comissão</th>
                <th className="p-4">Total Pago</th>
                <th className="p-4">Saldo a Receber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map(s => (
                <tr key={s.contract_id} className="hover:bg-slate-50/50">
                  <td className="p-4">{s.contract_id}</td>
                  <td className="p-4">{s.client_name}</td>
                  <td className="p-4">R$ {Number(s.total_commission).toFixed(2)}</td>
                  <td className="p-4">R$ {Number(s.total_paid).toFixed(2)}</td>
                  <td className="p-4 font-bold text-emerald-600">R$ {Number(s.remaining_balance).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

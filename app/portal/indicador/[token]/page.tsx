'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/portal/Header'
import { KPICard } from '@/components/portal/KPICard'
import { CommissionTable } from '@/components/portal/CommissionTable'
import { CommissionChart } from '@/components/portal/CommissionChart'
import { DollarSign, TrendingUp } from 'lucide-react'

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
        .select('indicator_id, type, expires_at, is_active, indicators(name)')
        .eq('token', token)
        .single()

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
        .from('vw_portal_commission_details')
        .select('*')
        .eq('indicator_id', tokenData.indicator_id);

      // 3. Get detailed payment history
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('commission_payments')
        .select('*, contracts(id)')
        .eq('indicator_id', tokenData.indicator_id);

      if (statusError) {
        console.error('Erro detalhado do Supabase:', statusError);
        setErrorMsg('Erro ao buscar comissões: ' + statusError.message);
      } else {
        console.log('Dados recebidos da View:', statusData);
        
        const indicatorName = (tokenData.indicators as any)?.name || 'Indicador';
        
        const dataWithPayments = (statusData || []).map((item: any) => ({
          ...item,
          payments: (paymentsData || []).filter((p: any) => p.contract_id === item.contract_id)
        }));

        if (!statusData || statusData.length === 0) {
          setData([{
            indicator_name: indicatorName,
            total_commission: 0,
            remaining_balance: 0,
            isEmpty: true
          }]);
        } else {
          setData(dataWithPayments.map((item: any) => ({ ...item, indicator_name: item.indicator_name || indicatorName })));
        }
      }
      
      setLoading(false)
    }

    fetchPortalData()
  }, [token])

  if (loading) return <div className="p-6">Carregando...</div>
  if (errorMsg) return <div className="p-6 text-red-600 font-medium">{errorMsg}</div>

  const indicatorName = data.length > 0 ? data[0].indicator_name : 'Indicador';
  const totalCommissions = data.filter(d => !d.isEmpty).reduce((acc, curr) => acc + Number(curr.total_commission || 0), 0);
  const totalPaid = data.filter(d => !d.isEmpty).reduce((acc, curr) => acc + Number(curr.total_paid || 0), 0);
  const totalRemaining = data.filter(d => !d.isEmpty).reduce((acc, curr) => acc + Number(curr.remaining_balance || 0), 0);
  const displayData = data.filter(d => !d.isEmpty);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <Header name={indicatorName} />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KPICard 
            title="Total de Comissões" 
            value={`R$ ${totalCommissions.toFixed(2)}`} 
            icon={<DollarSign size={20} />}
          />
          <KPICard 
            title="Total Pago" 
            value={`R$ ${totalPaid.toFixed(2)}`} 
            icon={<DollarSign size={20} />}
            trend="Saldo atualizado"
          />
          <KPICard 
            title="Total a Receber" 
            value={`R$ ${totalRemaining.toFixed(2)}`} 
            icon={<TrendingUp size={20} />}
            trend="Saldo atualizado"
          />
        </div>

        {displayData.length > 0 ? (
          <>
            <CommissionChart data={displayData} />
            <CommissionTable data={displayData} />
            
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
              <h3 className="text-xl font-bold text-slate-950 mb-6">Próximos Recebimentos</h3>
              <p className="text-slate-500">Nenhum recebimento previsto para os próximos 30 dias.</p>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
            <p className="text-slate-500">Nenhuma comissão registrada até o momento.</p>
          </div>
        )}
      </div>
    </div>
  )
}

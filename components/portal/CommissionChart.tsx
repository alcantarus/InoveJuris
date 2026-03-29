'use client'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface CommissionChartProps {
  data: any[]
}

export function CommissionChart({ data }: CommissionChartProps) {
  const chartData = data.map(item => ({
    name: `Contrato ${item.contract_id}`,
    commission: Number(item.total_commission)
  }))

  return (
    <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
      <h3 className="text-xl font-bold text-slate-950 mb-8">Evolução de Comissões</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorCommission" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Area type="monotone" dataKey="commission" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorCommission)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

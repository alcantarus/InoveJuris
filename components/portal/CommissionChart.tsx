'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface CommissionChartProps {
  data: any[]
}

export function CommissionChart({ data }: CommissionChartProps) {
  // Simple aggregation for chart
  const chartData = data.map(item => ({
    name: `Contrato ${item.contract_id}`,
    commission: Number(item.total_commission)
  }))

  return (
    <div className="p-6 border-none shadow-sm bg-white rounded-2xl">
      <h3 className="text-lg font-semibold text-slate-900 mb-6">Evolução de Comissões</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="commission" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

import { Card } from '@/components/ui/Card'

interface KPICardProps {
  title: string
  value: string
  icon?: React.ReactNode
  trend?: string
}

export function KPICard({ title, value, icon, trend }: KPICardProps) {
  return (
    <Card className="p-6 border-none shadow-sm bg-white rounded-2xl">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        {icon && <div className="text-indigo-600">{icon}</div>}
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {trend && <p className="text-xs text-emerald-600 mt-2 font-medium">{trend}</p>}
    </Card>
  )
}

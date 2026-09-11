interface KPICardProps {
  title: string
  value: string
  icon?: React.ReactNode
  trend?: string
}

export function KPICard({ title, value, icon, trend }: KPICardProps) {
  return (
    <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">{icon}</div>
      </div>
      <p className="text-4xl font-extrabold text-slate-950 tracking-tight">{value}</p>
      {trend && <p className="text-sm text-emerald-600 mt-3 font-medium bg-emerald-50 inline-block px-3 py-1 rounded-full">{trend}</p>}
    </div>
  )
}

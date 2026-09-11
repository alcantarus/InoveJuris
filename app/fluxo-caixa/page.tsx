'use client'

import DashboardLayout from '../dashboard-layout'
import { cn } from '@/lib/utils'

export default function FluxoCaixaPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-8">Fluxo de Caixa</h1>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <p className="text-slate-600">Sistema em manutenção para restauração de dados.</p>
        </div>
      </div>
    </DashboardLayout>
  )
}

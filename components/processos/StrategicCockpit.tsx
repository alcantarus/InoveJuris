import React from 'react'
import { ArrowUpRight, BriefcaseBusiness, Clock3, LockKeyhole, Wallet } from 'lucide-react'
import { formatCurrency, getTodayBR } from '@/lib/utils'
import { usePrivacyVersion } from '@/lib/usePrivacyVersion'
import { KPICard } from '@/components/ui/KPICard'

const INACTIVE_STATUSES = ['arquivado', 'concluído', 'concluido', 'baixado', 'encerrado', 'cancelado']

function nearestDeadline(process: any): string | null {
  const deadlines = Array.isArray(process.process_deadlines) ? process.process_deadlines : []
  if (deadlines.length === 0) return null
  return deadlines
    .map((d: any) => String(d.deadline_date).slice(0, 10))
    .filter(Boolean)
    .sort()[0] || null
}

function daysUntil(date: string | null): number {
  if (!date) return Number.POSITIVE_INFINITY
  const today = new Date(`${getTodayBR()}T00:00:00`)
  const target = new Date(`${date}T00:00:00`)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/**
 * Carteira consolidada do escritório (modelo 05-processos.md).
 * Mantém as métricas de risco/urgência já usadas no InoveJuris em uma linha
 * secundária, sem poluir os KPIs principais.
 */
export function StrategicCockpit({ processes, isVisible }: { processes: any[], isVisible?: (key: string) => boolean }) {
  usePrivacyVersion()
  const showValues = isVisible ? isVisible('process_all') : true

  const active = processes.filter(p => !INACTIVE_STATUSES.includes(String(p.status || '').toLowerCase().trim()))

  const withDeadlineIn7Days = new Set(
    processes
      .filter(p => {
        const days = daysUntil(nearestDeadline(p))
        return days >= 0 && days <= 7
      })
      .map(p => p.id)
  ).size

  const secretJustice = processes.filter(p => p.secret_justice === true).length
  const totalValue = processes.reduce((acc, p) => acc + Number(p.case_value || 0), 0)

  const risk = processes.reduce((acc: Record<string, number>, p) => {
    const key = p.risk_assessment || 'Possível'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const urgent = processes.filter(p =>
    Array.isArray(p.tags)
      ? p.tags.some((tag: string) => String(tag).toLowerCase().includes('urgente'))
      : String(p.tags || '').toLowerCase().includes('urgente')
  ).length

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">Carteira do escritório</p>
          <h2 className="text-lg font-bold text-slate-900">Processos</h2>
          <p className="text-xs text-slate-500">
            Visão consolidada de {processes.length} {processes.length === 1 ? 'processo' : 'processos'}, com responsável, fase e próximo prazo.
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
          <ArrowUpRight size={14} /> Dados do DataJud sob demanda
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          title="Ativos"
          value={`${active.length} de ${processes.length}`}
          icon={BriefcaseBusiness}
          color="indigo"
        />
        <KPICard
          title="Com prazo em 7 dias"
          value={`${withDeadlineIn7Days} ${withDeadlineIn7Days === 1 ? 'processo' : 'processos'}`}
          icon={Clock3}
          color="amber"
        />
        <KPICard
          title="Segredo de justiça"
          value={`${secretJustice} ${secretJustice === 1 ? 'processo' : 'processos'}`}
          icon={LockKeyhole}
          color="rose"
        />
        <KPICard
          title="Valor da carteira"
          value={formatCurrency(totalValue, showValues)}
          icon={Wallet}
          color="emerald"
          isVisible={showValues}
          onToggleVisibility={isVisible ? () => isVisible('process_all') : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-[11px] text-slate-500">
        <span>
          <strong className="text-slate-700">Matriz de risco:</strong>{' '}
          {risk['Provável'] || 0} prováveis · {risk['Possível'] || 0} possíveis · {risk['Remoto'] || 0} remotos
        </span>
        <span>
          <strong className="text-slate-700">Radar de urgência:</strong> {urgent} {urgent === 1 ? 'pendente' : 'pendentes'}
        </span>
      </div>
    </section>
  )
}

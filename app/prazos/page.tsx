'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { KPICard } from '@/components/ui/KPICard'
import { Modal } from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import { getAppEnv } from '@/lib/env'
import { cn, formatDate, getTodayBR, matchesSearch } from '@/lib/utils'
import {
  BUCKET_LABELS,
  countBuckets,
  exportDeadlinesCsv,
  fetchDeadlines,
  type DeadlineBucket,
  type DeadlineItem,
  type ProcessOption,
} from '@/lib/deadlines'

type Filter = DeadlineBucket | 'todos'

const FILTERS: Filter[] = ['todos', 'vencidos', 'hoje', '7dias', '30dias', 'aberto', 'concluido']

const priorityClasses: Record<string, string> = {
  Alta: 'bg-rose-100 text-rose-700 border-rose-200',
  Média: 'bg-amber-100 text-amber-700 border-amber-200',
  Baixa: 'bg-slate-100 text-slate-600 border-slate-200',
}

function bucketBadgeClass(item: DeadlineItem): string {
  if (item.status && ['concluido', 'concluído', 'finalizado', 'baixado', 'cancelado'].some(s => item.status.toLowerCase().includes(s))) {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  }
  if (item.daysRemaining < 0) return 'bg-rose-100 text-rose-700 border-rose-200'
  if (item.daysRemaining === 0) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function daysLabel(item: DeadlineItem): string {
  if (item.bucket === 'concluido') return 'Concluído'
  if (item.daysRemaining < 0) return `Venceu há ${Math.abs(item.daysRemaining)} ${Math.abs(item.daysRemaining) === 1 ? 'dia' : 'dias'}`
  if (item.daysRemaining === 0) return 'Vence hoje'
  return `Faltam ${item.daysRemaining} ${item.daysRemaining === 1 ? 'dia' : 'dias'}`
}

export default function PrazosPage() {
  const [items, setItems] = useState<DeadlineItem[]>([])
  const [processOptions, setProcessOptions] = useState<ProcessOption[]>([])
  const [filter, setFilter] = useState<Filter>('aberto')
  const [search, setSearch] = useState('')
  const [responsible, setResponsible] = useState('')
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ process_id: '', deadline_date: getTodayBR(), description: '' })

  const load = async () => {
    setLoading(true)
    const payload = await fetchDeadlines()
    setItems(payload.items)
    setProcessOptions(payload.processOptions)
    if (payload.error) {
      toast.error('Não foi possível carregar os prazos.', { description: payload.error })
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => countBuckets(items), [items])
  const responsibleOptions = useMemo(
    () => Array.from(new Set(items.map(i => i.responsible).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items]
  )

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filter !== 'todos' && item.bucket !== filter) return false
      if (responsible && item.responsible !== responsible) return false
      if (!matchesSearch(search, item.clientName, item.processNumber, item.description, item.area, item.responsible)) return false
      return true
    })
  }, [items, filter, responsible, search])

  const exportCsv = () => {
    exportDeadlinesCsv(filtered)
    toast.success('CSV exportado com sucesso.')
  }

  const createDeadline = async () => {
    if (!form.process_id || !form.deadline_date || !form.description.trim()) {
      toast.error('Preencha processo, vencimento e descrição.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('process_deadlines').insert([{
      process_id: Number(form.process_id),
      deadline_date: form.deadline_date,
      description: form.description.trim(),
      status: 'Pendente',
      environment: getAppEnv(),
    }])
    setSaving(false)
    if (error) {
      toast.error('Erro ao criar prazo.', { description: error.message })
      return
    }
    toast.success('Prazo criado com sucesso.')
    setIsModalOpen(false)
    setForm({ process_id: '', deadline_date: getTodayBR(), description: '' })
    await load()
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <ModuleHeader
            title="Prazos"
            description="Controle de prazos processuais com responsável, prioridade e situação."
            icon={CalendarClock}
          />
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/calendario"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <CalendarDays size={16} /> Calendário
            </Link>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download size={16} /> Exportar CSV
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={16} /> Novo prazo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <KPICard title="Vencidos" value={counts.vencidos} icon={AlertTriangle} color="rose" />
          <KPICard title="Hoje" value={counts.hoje} icon={Clock3} color="amber" />
          <KPICard title="Próximos 7 dias" value={counts['7dias']} icon={CalendarClock} color="indigo" />
          <KPICard title="Próximos 30 dias" value={counts['30dias']} icon={CalendarDays} color="slate" />
          <KPICard title="Em aberto" value={counts.vencidos + counts.hoje + counts['7dias'] + counts['30dias'] + counts.aberto} icon={FolderOpen} color="indigo" />
          <KPICard title="Concluídos" value={counts.concluido} icon={CheckCircle2} color="emerald" />
        </div>

        {counts.vencidos > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-rose-200 bg-rose-50"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-bold text-rose-900">
                  {counts.vencidos} {counts.vencidos === 1 ? 'prazo vencido sem baixa' : 'prazos vencidos sem baixa'}
                </p>
                <p className="text-xs text-rose-700 mt-0.5">
                  Regularize a pendência ou reabra o prazo com justificativa. O registro de providência ficará disponível na trilha de auditoria.
                </p>
              </div>
            </div>
            <button
              onClick={() => setFilter('vencidos')}
              className="self-start sm:self-auto px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
            >
              Ver vencidos
            </button>
          </motion.div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-slate-100">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                    filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {f === 'todos' ? 'Todos' : BUCKET_LABELS[f]}
                  <span className={cn('ml-1.5', filter === f ? 'text-indigo-200' : 'text-slate-400')}>
                    {f === 'todos' ? items.length : counts[f]}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por cliente, CNJ, tipo ou anotação..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <select
                value={responsible}
                onChange={e => setResponsible(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400"
              >
                <option value="">Todos os responsáveis</option>
                {responsibleOptions.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <button
                onClick={load}
                title="Atualizar"
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-bold">Tipo / Descrição</th>
                  <th className="px-4 py-3 font-bold">Prioridade</th>
                  <th className="px-4 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold">CNJ</th>
                  <th className="px-4 py-3 font-bold">Área</th>
                  <th className="px-4 py-3 font-bold">Responsável</th>
                  <th className="px-4 py-3 font-bold">Vencimento</th>
                  <th className="px-4 py-3 font-bold text-right">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Carregando prazos...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Nenhum prazo encontrado para os filtros selecionados.</td></tr>
                )}
                {!loading && filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 line-clamp-1">{item.description}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{item.court}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block px-2 py-1 rounded-md border text-[10px] font-bold', priorityClasses[item.priority] || priorityClasses.Média)}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 line-clamp-1">{item.clientName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.processNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{item.area}</td>
                    <td className="px-4 py-3 text-slate-600 line-clamp-1">{item.responsible}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDate(item.deadlineDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('inline-block px-2 py-1 rounded-md border text-[10px] font-bold whitespace-nowrap', bucketBadgeClass(item))}>
                        {daysLabel(item)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'prazo exibido' : 'prazos exibidos'} de {items.length} no total
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo prazo">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Processo</label>
            <select
              value={form.process_id}
              onChange={e => setForm(prev => ({ ...prev, process_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400"
            >
              <option value="">Selecione o processo</option>
              {processOptions.map(p => (
                <option key={p.id} value={p.id}>{p.number} — {p.client}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Vencimento</label>
            <input
              type="date"
              value={form.deadline_date}
              onChange={e => setForm(prev => ({ ...prev, deadline_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Descrição</label>
            <input
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Ex.: Contestação, Embargos de declaração..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={createDeadline}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar prazo'}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}

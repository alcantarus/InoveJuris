'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { addMonths, format, isSameMonth, startOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  List,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { KPICard } from '@/components/ui/KPICard'
import { cn, formatDate, getTodayBR, matchesSearch } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { DeadlineEditModal } from '@/components/prazos/DeadlineEditModal'
import { DeleteDeadlineModal, type DeleteDeadlineTarget } from '@/components/prazos/DeleteDeadlineModal'
import {
  BUCKET_LABELS,
  countBuckets,
  exportDeadlinesCsv,
  fetchDeadlines,
  type DeadlineBucket,
  type DeadlineItem,
} from '@/lib/deadlines'
import { CalendarGrid, bucketClasses } from '@/components/calendario/CalendarGrid'
import { DeadlineListView } from '@/components/calendario/DeadlineListView'

type ViewMode = 'calendar' | 'list'
type ListFilter = DeadlineBucket | 'todos'

const FILTERS: ListFilter[] = ['todos', 'vencidos', 'hoje', '7dias', '30dias', 'aberto', 'concluido']

export default function CalendarioPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<DeadlineItem[]>([])
  const [lawyers, setLawyers] = useState<any[]>([])
  const [editingDeadline, setEditingDeadline] = useState<DeadlineItem | null>(null)
  const [deletingDeadline, setDeletingDeadline] = useState<DeleteDeadlineTarget | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => new Date(`${getTodayBR()}T12:00:00`))
  const [selectedDate, setSelectedDate] = useState<string | null>(getTodayBR())
  const [view, setView] = useState<ViewMode>('calendar')
  const [listDate, setListDate] = useState<string | null>(null)
  const [filter, setFilter] = useState<ListFilter>('todos')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const payload = await fetchDeadlines()
    setItems(payload.items)
    setLawyers(payload.lawyers || [])
    if (payload.error) {
      toast.error('Não foi possível carregar os prazos.', { description: payload.error })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('calendario-deadlines-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'process_deadlines' }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const counts = useMemo(() => countBuckets(items), [items])

  const byDate = useMemo(() => {
    const map = new Map<string, DeadlineItem[]>()
    items.forEach(item => {
      const key = String(item.deadlineDate).slice(0, 10)
      const list = map.get(key) || []
      list.push(item)
      map.set(key, list)
    })
    return map
  }, [items])

  const monthItems = useMemo(
    () => items.filter(item => isSameMonth(new Date(`${String(item.deadlineDate).slice(0, 10)}T12:00:00`), month)),
    [items, month]
  )

  const filteredList = useMemo(() => {
    return monthItems.filter(item => {
      if (filter !== 'todos' && item.bucket !== filter) return false
      if (listDate && String(item.deadlineDate).slice(0, 10) !== listDate) return false
      if (!matchesSearch(search, item.description, item.clientName, item.processNumber, item.responsible, item.area)) return false
      return true
    })
  }, [monthItems, filter, listDate, search])

  const visibleItems = view === 'list' ? filteredList : monthItems
  const overdue = useMemo(() => items.filter(item => item.bucket === 'vencidos'), [items])
  const selectedItems = selectedDate ? (byDate.get(selectedDate) || []) : []
  const upcoming = useMemo(
    () => monthItems.filter(item => item.bucket !== 'concluido' && item.daysRemaining >= 0).slice(0, 6),
    [monthItems]
  )

  const todayKey = getTodayBR()
  const monthKey = format(month, 'yyyy-MM')
  const rawTitle = format(month, "MMMM 'de' yyyy", { locale: ptBR })
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1)

  const goToMonth = (delta: number) => {
    const next = delta > 0 ? addMonths(month, 1) : subMonths(month, 1)
    setMonth(next)
    if (selectedDate && !isSameMonth(new Date(`${selectedDate}T12:00:00`), next)) {
      setSelectedDate(format(startOfMonth(next), 'yyyy-MM-dd'))
    }
  }

  const goToday = () => {
    setMonth(new Date(`${todayKey}T12:00:00`))
    setSelectedDate(todayKey)
  }

  const showList = (bucket: ListFilter = 'todos') => {
    setView('list')
    setFilter(bucket)
    setListDate(null)
  }

  const exportCsv = () => {
    exportDeadlinesCsv(visibleItems, `prazos-${monthKey}.csv`)
    toast.success(`${visibleItems.length} ${visibleItems.length === 1 ? 'prazo exportado' : 'prazos exportados'} em CSV.`)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <ModuleHeader
            title="Prazos"
            description="Controle de prazos com dias úteis, responsável, memória de cálculo e confirmação do advogado."
            icon={CalendarClock}
          />
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl p-1 flex items-center shadow-sm">
              <button
                type="button"
                onClick={() => setView('calendar')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                  view === 'calendar' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <CalendarDays size={15} /> Calendário
              </button>
              <button
                type="button"
                onClick={() => showList()}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                  view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <List size={15} /> Listar
              </button>
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download size={16} /> Exportar CSV
            </button>
            <Link
              href="/prazos"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={16} /> Novo prazo
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <KPICard title="Hoje" value={counts.hoje} icon={Clock3} color="amber" />
          <KPICard title="Vencidos" value={counts.vencidos} icon={AlertTriangle} color="rose" />
          <KPICard title="7 dias" value={counts['7dias']} icon={CalendarClock} color="indigo" />
          <KPICard title="Neste mês" value={monthItems.length} icon={CalendarCheck2} color="emerald" />
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
                  {counts.vencidos} {counts.vencidos === 1 ? 'prazo vencido' : 'prazos vencidos'}
                </p>
                <p className="text-xs text-rose-700 mt-0.5">
                  Prazos vencidos continuam destacados na agenda até que a providência seja registrada.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => showList('vencidos')}
              className="self-start sm:self-auto px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
            >
              Ver lista
            </button>
          </motion.div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900 min-w-[190px]">{title}</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goToMonth(-1)}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => goToMonth(1)}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-label="Próximo mês"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                <strong className="text-slate-700">{monthItems.length}</strong> {monthItems.length === 1 ? 'prazo no mês' : 'prazos no mês'}
              </span>
              <button
                type="button"
                onClick={load}
                title="Atualizar"
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {view === 'calendar' ? (
            <CalendarGrid
              month={month}
              byDate={byDate}
              selectedDate={selectedDate}
              todayKey={todayKey}
              onSelectDate={setSelectedDate}
            />
          ) : (
            <div className="p-4 space-y-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por prazo, cliente, CNJ ou responsável..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value as ListFilter)}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400"
                >
                  {FILTERS.map(option => (
                    <option key={option} value={option}>
                      {option === 'todos' ? 'Todas as situações' : BUCKET_LABELS[option]}
                    </option>
                  ))}
                </select>
              </div>
              {listDate && (
                <button
                  type="button"
                  onClick={() => setListDate(null)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100"
                >
                  Data: {formatDate(listDate)} <X size={12} />
                </button>
              )}
            </div>
          )}

          {view === 'list' && (
            <DeadlineListView items={filteredList} onEdit={setEditingDeadline} onDelete={setDeletingDeadline} />
          )}
        </div>

        {view === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedDate
                    ? `Prazos em ${format(new Date(`${selectedDate}T12:00:00`), "d 'de' MMMM", { locale: ptBR })}`
                    : 'Selecione uma data'}
                </h3>
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => {
                      showList()
                      setListDate(selectedDate)
                    }}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Ver na lista
                  </button>
                )}
              </div>
              {selectedItems.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">Nenhum prazo nesta data.</p>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                  {selectedItems.map(item => (
                    <div key={item.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{item.description}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={cn('px-2 py-1 rounded-md border text-[10px] font-bold', bucketClasses[item.bucket])}>
                            {BUCKET_LABELS[item.bucket]}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingDeadline(item)}
                            title="Editar prazo"
                            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingDeadline(item)}
                            title="Excluir prazo"
                            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg p-2 text-rose-500 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{item.clientName} · {item.processNumber}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.responsible} · {item.area}</p>
                      {item.businessDays != null && (
                        <p className="text-[11px] font-bold text-indigo-600 mt-1">{item.businessDays} dias úteis</p>
                      )}
                      {item.confirmedAt && (
                        <p className="text-[11px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Confirmado pelo advogado
                        </p>
                      )}
                      {item.calculationMemory && (
                        <p className="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap border-t border-slate-200 pt-2">
                          {item.calculationMemory}
                        </p>
                      )}
                      {item.process_id != null && (
                        <Link
                          href={`/processos/${item.process_id}`}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                        >
                          Abrir processo <CalendarClock size={12} />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Próximos prazos do mês</h3>
                <button type="button" onClick={() => showList()} className="text-xs font-bold text-indigo-600 hover:underline">
                  Ver todos
                </button>
              </div>
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">Nenhum prazo futuro neste mês.</p>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                  {upcoming.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedDate(String(item.deadlineDate).slice(0, 10))}
                      className="w-full flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 text-left transition-colors"
                    >
                      <span className={cn('mt-0.5 h-2 w-2 rounded-full shrink-0', bucketClasses[item.bucket].split(' ')[0])} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 truncate">{item.description}</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">
                          {formatDate(item.deadlineDate)} · {item.clientName}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Prazos vencidos pendentes de baixa</h3>
                <span className="text-xs font-bold text-rose-600">{overdue.length}</span>
              </div>
              {overdue.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">Nenhum prazo vencido.</p>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                  {overdue.map(item => (
                    <div key={item.id} className="p-3 rounded-xl border border-rose-100 bg-rose-50/60">
                      <p className="text-sm font-semibold text-rose-900 truncate">{item.description}</p>
                      <p className="text-xs text-rose-700 truncate">{item.clientName} · {item.processNumber}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatDate(item.deadlineDate)} · venceu há {Math.abs(item.daysRemaining)} dias
                      </p>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => showList('vencidos')}
                    className="w-full mt-2 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
                  >
                    Regularizar vencidos
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DeadlineEditModal
        deadline={editingDeadline}
        lawyers={lawyers}
        userId={user?.id ?? null}
        source="calendario"
        onClose={() => setEditingDeadline(null)}
        onSaved={load}
      />

      <DeleteDeadlineModal
        target={deletingDeadline}
        userId={user?.id ?? null}
        source="calendario"
        onDeleted={load}
        onClose={() => setDeletingDeadline(null)}
      />
    </DashboardLayout>
  )
}

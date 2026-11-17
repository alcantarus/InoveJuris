'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  RefreshCw,
} from 'lucide-react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { cn, formatDate, getTodayBR } from '@/lib/utils'
import { BUCKET_LABELS, countBuckets, fetchDeadlines, type DeadlineBucket, type DeadlineItem } from '@/lib/deadlines'

const WEEKDAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

const eventClasses: Record<DeadlineBucket, string> = {
  vencidos: 'bg-rose-100 text-rose-800 border-rose-200',
  hoje: 'bg-amber-100 text-amber-800 border-amber-200',
  '7dias': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  '30dias': 'bg-sky-50 text-sky-700 border-sky-100',
  aberto: 'bg-slate-100 text-slate-700 border-slate-200',
  concluido: 'bg-emerald-50 text-emerald-700 border-emerald-100',
}

export default function CalendarioPage() {
  const [items, setItems] = useState<DeadlineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => new Date(`${getTodayBR()}T12:00:00`))
  const [selectedDate, setSelectedDate] = useState<string | null>(getTodayBR())

  const load = async () => {
    setLoading(true)
    const payload = await fetchDeadlines()
    setItems(payload.items)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

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

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const todayKey = getTodayBR()
  const selectedItems = selectedDate ? (byDate.get(selectedDate) || []) : []
  const overdue = items.filter(item => item.bucket === 'vencidos')

  const monthTitle = format(month, "MMMM 'de' yyyy", { locale: ptBR })
  const title = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <ModuleHeader
            title="Calendário"
            description="Agenda de prazos do escritório. Prazos vencidos permanecem destacados até a baixa."
            icon={CalendarClock}
          />
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/prazos"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <List size={16} /> Ver lista
            </Link>
            <Link
              href="/prazos"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={16} /> Novo prazo
            </Link>
          </div>
        </div>

        {counts.vencidos > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-2xl border border-rose-200 bg-rose-50"
          >
            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-bold text-rose-900">
                {counts.vencidos} {counts.vencidos === 1 ? 'prazo vencido' : 'prazos vencidos'}
              </p>
              <p className="text-xs text-rose-700 mt-0.5">
                Prazos vencidos continuam destacados na agenda até que a providência seja registrada.
              </p>
            </div>
          </motion.div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900 min-w-[190px]">{title}</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMonth(prev => subMonths(prev, 1))}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => { setMonth(new Date(`${todayKey}T12:00:00`)); setSelectedDate(todayKey) }}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hoje
                </button>
                <button
                  onClick={() => setMonth(prev => addMonths(prev, 1))}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-label="Próximo mês"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {items.filter(i => isSameMonth(new Date(`${i.deadlineDate}T12:00:00`), month)).length} prazos no mês
              </span>
              <button
                onClick={load}
                title="Atualizar"
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {WEEKDAYS.map(day => (
              <div key={day} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd')
              const dayItems = byDate.get(key) || []
              const isToday = key === todayKey
              const isCurrentMonth = isSameMonth(day, month)
              const isSelected = key === selectedDate

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={cn(
                    'min-h-[92px] sm:min-h-[110px] p-1.5 sm:p-2 text-left border-b border-r border-slate-100 transition-colors',
                    !isCurrentMonth && 'bg-slate-50/60 opacity-50',
                    isSelected ? 'bg-indigo-50/70 ring-1 ring-inset ring-indigo-200' : 'hover:bg-slate-50'
                  )}
                >
                  <span className={cn(
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                    isToday ? 'bg-indigo-600 text-white' : 'text-slate-600'
                  )}>
                    {format(day, 'd')}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayItems.slice(0, 3).map(item => (
                      <div
                        key={item.id}
                        className={cn('px-1.5 py-0.5 rounded border text-[10px] font-semibold truncate', eventClasses[item.bucket])}
                        title={`${item.description} — ${item.clientName}`}
                      >
                        {item.description}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-[10px] text-slate-500 pl-1">+{dayItems.length - 3} prazos</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                {selectedDate ? `Prazos em ${format(new Date(`${selectedDate}T12:00:00`), "d 'de' MMMM", { locale: ptBR })}` : 'Selecione uma data'}
              </h3>
              {selectedDate && (
                <Link href={`/prazos?data=${selectedDate}`} className="text-xs font-bold text-indigo-600 hover:underline">
                  Ver na lista
                </Link>
              )}
            </div>
            {selectedItems.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">Nenhum prazo nesta data.</p>
            ) : (
              <div className="space-y-2">
                {selectedItems.map(item => (
                  <div key={item.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.description}</p>
                      <p className="text-xs text-slate-500 truncate">{item.clientName} · {item.processNumber}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.responsible} · {item.area}</p>
                    </div>
                    <span className={cn('shrink-0 px-2 py-1 rounded-md border text-[10px] font-bold', eventClasses[item.bucket])}>
                      {BUCKET_LABELS[item.bucket]}
                    </span>
                  </div>
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
              <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                {overdue.map(item => (
                  <div key={item.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-rose-100 bg-rose-50/60">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-rose-900 truncate">{item.description}</p>
                      <p className="text-xs text-rose-700 truncate">{item.clientName} · {item.processNumber}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(item.deadlineDate)} · venceu há {Math.abs(item.daysRemaining)} dias</p>
                    </div>
                    <Link href="/prazos" className="shrink-0 text-xs font-bold text-rose-700 hover:underline">
                      Regularizar
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

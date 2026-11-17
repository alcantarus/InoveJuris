'use client'

import React, { useMemo } from 'react'
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { cn } from '@/lib/utils'
import { BUCKET_LABELS, type DeadlineBucket, type DeadlineItem } from '@/lib/deadlines'

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

const BUCKET_ORDER: DeadlineBucket[] = ['vencidos', 'hoje', '7dias', '30dias', 'aberto', 'concluido']

export const bucketClasses: Record<DeadlineBucket, string> = {
  vencidos: 'bg-rose-100 text-rose-800 border-rose-200',
  hoje: 'bg-amber-100 text-amber-800 border-amber-200',
  '7dias': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  '30dias': 'bg-sky-50 text-sky-700 border-sky-100',
  aberto: 'bg-slate-100 text-slate-700 border-slate-200',
  concluido: 'bg-emerald-50 text-emerald-700 border-emerald-100',
}

interface CalendarGridProps {
  month: Date
  byDate: Map<string, DeadlineItem[]>
  selectedDate: string | null
  todayKey: string
  onSelectDate: (date: string) => void
}

export function CalendarGrid({ month, byDate, selectedDate, todayKey, onSelectDate }: CalendarGridProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [month])

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={cn(
              'py-2.5 text-center text-[10px] font-bold uppercase tracking-wider',
              index === 0 || index === 6 ? 'text-rose-400 bg-rose-50/40' : 'text-slate-500'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const dayItems = (byDate.get(key) || []).slice().sort((a, b) =>
            BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket)
          )
          const isToday = key === todayKey
          const isCurrentMonth = isSameMonth(day, month)
          const isSelected = key === selectedDate
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const hasOverdue = dayItems.some(item => item.bucket === 'vencidos')

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              title={dayItems.length ? dayItems.map(i => `${i.description} — ${BUCKET_LABELS[i.bucket]}`).join('\n') : undefined}
              className={cn(
                'relative min-h-[86px] sm:min-h-[108px] p-1 sm:p-1.5 text-left border-b border-r border-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400',
                !isCurrentMonth && 'bg-slate-50/70 opacity-55',
                isCurrentMonth && isWeekend && 'bg-rose-50/30',
                isSelected ? 'bg-indigo-50/80 ring-1 ring-inset ring-indigo-300' : 'hover:bg-slate-50',
                hasOverdue && isCurrentMonth && 'border-b-rose-200'
              )}
            >
              <span className="flex items-center gap-1">
                <span className={cn(
                  'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold',
                  isToday ? 'bg-indigo-600 text-white shadow-sm' : isWeekend ? 'text-rose-500' : 'text-slate-600'
                )}>
                  {format(day, 'd')}
                </span>
                {dayItems.length > 0 && !isToday && (
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    hasOverdue ? 'bg-rose-500' : 'bg-indigo-400'
                  )} />
                )}
              </span>

              <span className="mt-1 block space-y-1">
                {dayItems.slice(0, 3).map(item => (
                  <span
                    key={item.id}
                    className={cn('block px-1 py-0.5 rounded border text-[10px] font-semibold truncate', bucketClasses[item.bucket])}
                  >
                    {item.description}
                  </span>
                ))}
                {dayItems.length > 3 && (
                  <span className="block text-[10px] text-slate-500 pl-1">+{dayItems.length - 3} prazos</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

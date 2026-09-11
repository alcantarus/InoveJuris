'use client'

import React from 'react'
import { AlertTriangle, TrendingUp, Users, Calendar } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function DashboardReceivablesCards({ 
  receivablesMetrics, 
  receivablesForecast, 
  topDefaulters 
}: { 
  receivablesMetrics: any[], 
  receivablesForecast: any[], 
  topDefaulters: any[] 
}) {
  // 1. Termômetro de Inadimplência
  const metrics = receivablesMetrics[0] || {}
  const totalPendingAmount = Number(metrics.total_pending || 0)
  const totalOverdueAmount = Number(metrics.total_overdue || 0)
  const delinquencyPercent = totalPendingAmount > 0 ? (totalOverdueAmount / totalPendingAmount) * 100 : 0

  // 2. Previsão de Entrada (Próximos 15 dias)
  const forecastData = receivablesForecast.map((f: any) => ({ 
    date: formatDate(f.due_date), 
    amount: Number(f.expected_amount) 
  }))

  // 3. Top 5 Clientes Inadimplentes
  const topDefaultersList = topDefaulters.slice(0, 5)

  // 4. Vence Hoje
  const totalDueToday = Number(metrics.total_due_today || 0)
  const countDueToday = Number(metrics.count_due_today || 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Termômetro de Inadimplência */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="text-rose-500" />
          Termômetro de Inadimplência
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-4xl font-bold text-slate-900">{delinquencyPercent.toFixed(1)}%</p>
            <p className="text-sm text-slate-500">do total a receber em atraso</p>
          </div>
          <div className="w-24 h-24 rounded-full border-8 border-slate-100 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full border-8 border-rose-500" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%)`, transform: `rotate(${delinquencyPercent * 3.6}deg)` }}></div>
            <span className="font-bold text-rose-600">{delinquencyPercent.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* 4. Vence Hoje */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="text-amber-500" />
          Vence Hoje
        </h3>
        <p className="text-4xl font-bold text-slate-900">{countDueToday} títulos</p>
        <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalDueToday)}</p>
      </div>

      {/* 2. Previsão de Entrada */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="text-emerald-500" />
          Previsão de Entrada (Próximos 15 dias)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={forecastData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(Number(value) || 0)} />
              <Bar dataKey="amount" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Top 5 Clientes Inadimplentes */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="text-slate-500" />
          Top 5 Clientes Inadimplentes
        </h3>
        <div className="space-y-4">
          {topDefaultersList.map((d: any, idx) => (
            <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
              <span className="font-medium text-slate-900">{d.client_name}</span>
              <span className="font-bold text-rose-600">{formatCurrency(d.total_overdue_amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

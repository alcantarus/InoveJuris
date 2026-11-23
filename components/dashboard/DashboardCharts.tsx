'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { motion } from 'motion/react'
import { Eye, EyeOff, BarChart3 } from 'lucide-react'
import { cn, formatCurrency, formatCurrencyWith, formatPercent, formatPercentValue } from '@/lib/utils'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import type { User } from '@/lib/auth'

const COLORS = ['#4f46e5', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']

// Gráficos abaixo da dobra só são montados quando chegam perto da viewport.
// O placeholder mantém a altura para evitar salto de layout.
const DeferredBlock = ({ children, minHeight = 420 }: { children: React.ReactNode; minHeight?: number }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '800px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  return (
    <div ref={ref}>
      {visible ? children : (
        <div className="animate-pulse rounded-2xl bg-slate-100/70" style={{ minHeight }} />
      )}
    </div>
  )
}

interface DashboardChartsProps {
  user: User | null
  mixData: any[]
  revenueChartData: any[]
  cashFlowProjectionData: any[]
  profitabilityByArea: any[]
  areaChartData: any[]
  statusChartData: any[]
  instStatusChartData: any[]
  inssSuccessData: any[]
  leadTime: number
  winRate: number
  inssSuccessRate: number
  inssSuccessCount: number
}

export default function DashboardCharts({
  user,
  mixData,
  revenueChartData,
  cashFlowProjectionData,
  profitabilityByArea,
  areaChartData,
  statusChartData,
  instStatusChartData,
  inssSuccessData,
  leadTime,
  winRate,
  inssSuccessRate,
  inssSuccessCount,
}: DashboardChartsProps) {
  const { isVisible, toggleVisibility } = usePrivacy()

  return (
    <>
        <DeferredBlock minHeight={420}>

        {/* Charts Row 1: Revenue & Mix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Evolution */}
          {user?.canAccessContracts && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Evolução da Receita (Últimos 6 meses)</h3>
                  <button 
                    onClick={(e) => { e.preventDefault(); toggleVisibility('dashboard_revenue_evolution'); }} 
                    className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    title={isVisible('dashboard_revenue_evolution') ? "Ocultar valor" : "Mostrar valor"}
                  >
                    {isVisible('dashboard_revenue_evolution') ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Realizado</span>
                  </div>
                </div>
              </div>
              <div className={cn("h-[300px] w-full transition-all duration-300", !isVisible('dashboard_revenue_evolution') && "blur-sm pointer-events-none")}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(value) => formatCurrencyWith(value, n => `R$ ${n/1000}k`)} />
                    <Tooltip 
                      cursor={{ stroke: '#10b981', strokeWidth: 1 }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => formatCurrency(Number(value), isVisible('dashboard_revenue_evolution'))}
                    />
                    <Area type="monotone" dataKey="receita" name="Receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Mix de Contratos */}
          {user?.canAccessContracts && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-6">Composição de Carteira</h3>
              <div className="h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={mixData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {mixData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
                {mixData.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                    Sem dados
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        </DeferredBlock>

        <DeferredBlock minHeight={420}>

        {/* Charts Row 2: Cash Flow & Profitability */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cash Flow Projection */}
          {user?.canAccessCashFlow && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Projeção de Fluxo de Caixa (12 Meses)</h3>
                  <button 
                    onClick={(e) => { e.preventDefault(); toggleVisibility('dashboard_cashflow_projection'); }} 
                    className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    title={isVisible('dashboard_cashflow_projection') ? "Ocultar valor" : "Mostrar valor"}
                  >
                    {isVisible('dashboard_cashflow_projection') ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>Recorrente</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Êxito Est.</span>
                  </div>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={cashFlowProjectionData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => formatCurrencyWith(value, n => `R$ ${n/1000}k`)} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => formatCurrency(value, isVisible('dashboard_cashflow_projection'))}
                    />
                    <Bar dataKey="recorrente" name="Recorrente" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} barSize={30} />
                    <Bar dataKey="exito" name="Êxito Est." stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Profitability by Area */}
          {user?.canAccessContracts && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                    <BarChart3 size={20} />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Rentabilidade por Área</h3>
                    <button 
                      onClick={(e) => { e.preventDefault(); toggleVisibility('dashboard_profitability'); }} 
                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                      title={isVisible('dashboard_profitability') ? "Ocultar valor" : "Mostrar valor"}
                    >
                      {isVisible('dashboard_profitability') ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Volume financeiro total por área de atuação</p>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={profitabilityByArea} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                      width={100}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => formatCurrency(value, isVisible('dashboard_profitability'))}
                    />
                    <Bar dataKey="value" name="Rentabilidade" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24}>
                      {profitabilityByArea.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </div>

        </DeferredBlock>

        <DeferredBlock minHeight={420}>

        {/* Charts Row 3: Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Law Area Distribution */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-6">Contratos por Área</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={areaChartData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" name="Contratos" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Process Status Distribution */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-6">Status dos Processos</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={statusChartData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" name="Processos" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Installment Status Distribution */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-6">Status das Parcelas</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={instStatusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {instStatusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        </DeferredBlock>

        <DeferredBlock minHeight={420}>

        {/* Charts Row 4: Efficiency & INSS Success */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Efficiency & Performance */}
          <div className="grid grid-cols-1 gap-6 lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Lead Time Médio</h3>
                  <p className="text-xs text-slate-400 mb-4">Tempo médio para encerramento</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-slate-900">{leadTime.toFixed(0)}</span>
                    <span className="text-lg font-medium text-slate-500 mb-1">dias</span>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-500">Meta do Escritório</span>
                    <span className="text-emerald-600">365 dias</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-1000" 
                      style={{ width: `${Math.min((leadTime / 365) * 100, 100)}%` }} 
                    />
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Taxa de Sucesso</h3>
                  <p className="text-xs text-slate-400 mb-4">Processos com êxito</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-emerald-600">{formatPercentValue(winRate)}</span>
                    <span className="text-lg font-medium text-emerald-500 mb-1">%</span>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-500">Média do Mercado</span>
                    <span className="text-slate-400">65%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-1000" 
                      style={{ width: `${winRate}%` }} 
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* INSS Success Rate */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Taxa de Êxito INSS</h3>
              <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                {formatPercent(inssSuccessRate)}
              </div>
            </div>
            <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={inssSuccessData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f43f5e" />
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-900">{inssSuccessCount}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Deferidos</span>
              </div>
            </div>
          </motion.div>
        </div>

        </DeferredBlock>
    </>
  )
}

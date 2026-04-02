'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { 
  Search, 
  Monitor, 
  Smartphone, 
  Globe, 
  Clock, 
  LogOut, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Users,
  Activity,
  ShieldAlert,
  MapPin,
  ShieldCheck,
  BarChart3
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

import { getAppEnv } from '@/lib/env'
import { getTodayBR } from '@/lib/utils'

interface AccessLog {
  id: string
  user_id: number
  login_at: string
  last_seen_at: string
  logout_at: string | null
  ip_address: string
  user_agent: string
  location: string | null
  environment: string
  user: {
    name: string
    email: string
  }
}

interface FailedAttempt {
  id: string
  email: string
  ip_address: string
  user_agent: string
  reason: string
  attempted_at: string
}

export function AuditAccessLogs() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'failed' | 'analytics'>('sessions')
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [failedAttempts, setFailedAttempts] = useState<FailedAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [eventType, setEventType] = useState<string>('all')
  const currentEnv = getAppEnv()

  useEffect(() => {
    const fetchLogs = async () => {
      if (!isSupabaseConfigured) {
        setLoading(false)
        return
      }

      const [sessionsRes, failedRes] = await Promise.all([
        supabase
          .from('user_sessions')
          .select(`
            *,
            user:users!user_sessions_user_id_fkey(name, email)
          `)
          .eq('environment', currentEnv)
          .order('login_at', { ascending: false })
          .limit(500),
        supabase
          .from('login_attempts')
          .select('*')
          .order('attempted_at', { ascending: false })
          .limit(500)
      ])

      if (sessionsRes.error) {
        console.error('Error fetching access logs:', sessionsRes.error)
      } else {
        setLogs(sessionsRes.data || [])
      }

      if (failedRes.error) {
        console.error('Error fetching failed attempts:', failedRes.error)
      } else {
        setFailedAttempts(failedRes.data || [])
      }

      setLoading(false)
    }

    fetchLogs()
  }, [currentEnv])

  const handleTerminateSession = async (sessionId: string) => {
    if (!confirm('Tem certeza que deseja encerrar esta sessão? O usuário será desconectado.')) return

    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          logout_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      if (error) throw error

      setLogs(logs.map(log => 
        log.id === sessionId 
          ? { ...log, logout_at: new Date().toISOString() } 
          : log
      ))
      
      toast.success('Sessão encerrada com sucesso.')
    } catch (error) {
      console.error('Error terminating session:', error)
      toast.error('Erro ao encerrar sessão.')
    }
  }

  const handleTrustDevice = async (log: AccessLog) => {
    if (!confirm(`Deseja marcar este dispositivo (${log.user_agent}) como confiável para o usuário ${log.user?.name}?`)) return

    try {
      const { error } = await supabase
        .from('trusted_devices')
        .insert([{
          user_id: log.user_id,
          device_name: log.user_agent,
          user_agent: log.user_agent,
          ip_address: log.ip_address,
          location: log.location || 'Desconhecido',
          environment: currentEnv
        }])

      if (error) {
        if (error.code === '42P01') {
          toast.error('Tabela trusted_devices não existe. Execute o script SQL.');
        } else {
          throw error;
        }
      } else {
        toast.success('Dispositivo marcado como confiável.');
      }
    } catch (error) {
      console.error('Error trusting device:', error)
      toast.error('Erro ao marcar dispositivo como confiável.')
    }
  }

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase()
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone size={16} className="text-slate-500" />
    }
    return <Monitor size={16} className="text-slate-500" />
  }

  const getSessionStatus = (log: AccessLog) => {
    if (log.logout_at) {
      return { label: 'Encerrada', color: 'text-slate-500 bg-slate-100', icon: <LogOut size={14} /> }
    }
    
    const lastSeen = new Date(log.last_seen_at).getTime()
    const now = new Date().getTime()
    const diffMinutes = (now - lastSeen) / (1000 * 60)

    if (diffMinutes > 30) {
      return { label: 'Expirada', color: 'text-amber-600 bg-amber-50', icon: <AlertTriangle size={14} /> }
    }

    return { label: 'Ativa', color: 'text-emerald-600 bg-emerald-50', icon: <CheckCircle2 size={14} /> }
  }

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase()
    const matchesSearch = (
      log.user?.name?.toLowerCase().includes(term) ||
      log.user?.email?.toLowerCase().includes(term) ||
      log.ip_address?.toLowerCase().includes(term) ||
      log.environment?.toLowerCase().includes(term) ||
      log.location?.toLowerCase().includes(term)
    )
    
    const matchesUser = userFilter === 'all' || log.user_id.toString() === userFilter
    
    // Date filter
    const now = new Date()
    const loginDate = new Date(log.login_at)
    let matchesDate = true
    if (dateRange === 'today') matchesDate = loginDate.toDateString() === now.toDateString()
    else if (dateRange === '7days') matchesDate = (now.getTime() - loginDate.getTime()) <= 7 * 24 * 60 * 60 * 1000
    else if (dateRange === '30days') matchesDate = (now.getTime() - loginDate.getTime()) <= 30 * 24 * 60 * 60 * 1000

    return matchesSearch && matchesUser && matchesDate
  })

  const filteredFailed = failedAttempts.filter(attempt => {
    const term = searchTerm.toLowerCase()
    const matchesSearch = (
      attempt.email.toLowerCase().includes(term) ||
      attempt.ip_address.toLowerCase().includes(term) ||
      attempt.reason.toLowerCase().includes(term)
    )
    
    const matchesType = eventType === 'all' || attempt.reason.toLowerCase().includes(eventType.toLowerCase())

    // Date filter
    const now = new Date()
    const attemptDate = new Date(attempt.attempted_at)
    let matchesDate = true
    if (dateRange === 'today') matchesDate = attemptDate.toDateString() === now.toDateString()
    else if (dateRange === '7days') matchesDate = (now.getTime() - attemptDate.getTime()) <= 7 * 24 * 60 * 60 * 1000
    else if (dateRange === '30days') matchesDate = (now.getTime() - attemptDate.getTime()) <= 30 * 24 * 60 * 60 * 1000

    return matchesSearch && matchesType && matchesDate
  })

  const metrics = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    
    let activeCount = 0
    let todayCount = 0
    const uniqueUsers = new Set()

    logs.forEach(log => {
      const status = getSessionStatus(log)
      if (status.label === 'Ativa') activeCount++
      
      const loginTime = new Date(log.login_at).getTime()
      if (loginTime >= today) todayCount++

      uniqueUsers.add(log.user_id)
    })

    return {
      activeSessions: activeCount,
      loginsToday: todayCount,
      uniqueUsers: uniqueUsers.size
    }
  }, [logs])

      const analyticsData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      // Use toLocaleDateString with America/Sao_Paulo to get correct date for each of the last 7 days
      return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    }).reverse();
    
    return {
      logins: last7Days.map(date => ({
        date,
        logins: logs.filter(l => l.login_at.startsWith(date)).length
      })),
      failed: last7Days.map(date => ({
        date,
        attempts: failedAttempts.filter(a => a.attempted_at.startsWith(date)).length
      }))
    };
  }, [logs, failedAttempts]);

  const topData = useMemo(() => {
    const locations = logs.reduce((acc, log) => {
      const loc = log.location || 'Desconhecido'
      acc[loc] = (acc[loc] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const topLocations = Object.entries(locations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    const devices = logs.reduce((acc, log) => {
      const dev = log.user_agent.split(' ')[0] // Simple device parsing
      acc[dev] = (acc[dev] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const topDevices = Object.entries(devices)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    return { topLocations, topDevices }
  }, [logs])

  const exportToCSV = () => {
    if (activeTab === 'sessions') {
      const headers = ['Usuário', 'E-mail', 'Ambiente', 'Status', 'Login', 'Último Acesso', 'IP', 'Localização', 'Dispositivo']
      const rows = filteredLogs.map(log => {
        const status = getSessionStatus(log).label
        return [
          log.user?.name || 'Desconhecido',
          log.user?.email || '',
          log.environment === 'production' ? 'Produção' : 'Teste',
          status,
          new Date(log.login_at).toLocaleString('pt-BR'),
          new Date(log.last_seen_at).toLocaleString('pt-BR'),
          log.ip_address || '',
          log.location || 'Desconhecido',
          log.user_agent.replace(/,/g, ' ') // Remove commas to avoid CSV issues
        ]
      })

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `auditoria_acessos_${getTodayBR()}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      const headers = ['E-mail', 'Data/Hora', 'IP', 'Motivo', 'Dispositivo']
      const rows = filteredFailed.map(attempt => {
        return [
          attempt.email,
          new Date(attempt.attempted_at).toLocaleString('pt-BR'),
          attempt.ip_address,
          attempt.reason,
          attempt.user_agent.replace(/,/g, ' ')
        ]
      })

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `tentativas_falhas_${getTodayBR()}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <div className="space-y-6">
      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Sessões Ativas</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.activeSessions}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
            <LogOut size={24} className="rotate-180" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Acessos Hoje</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.loginsToday}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Usuários Únicos</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.uniqueUsers}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0">
            <ShieldAlert size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Falhas de Login</p>
            <p className="text-2xl font-bold text-rose-600">{failedAttempts.length}</p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-200">
        <button
          className={`whitespace-nowrap px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'sessions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('sessions')}
        >
          Histórico de Sessões
        </button>
        <button
          className={`whitespace-nowrap px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'failed'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('failed')}
        >
          Tentativas Falhas
        </button>
        <button
          className={`whitespace-nowrap px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'analytics'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics & Uso
        </button>
      </div>

      {activeTab !== 'analytics' && (
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder={activeTab === 'sessions' ? "Buscar por usuário, e-mail, IP, local..." : "Buscar por e-mail, IP, motivo..."}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select className="w-full md:w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={dateRange} onChange={(e) => setDateRange(e.target.value as any)}>
            <option value="all">Todo o período</option>
            <option value="today">Hoje</option>
            <option value="7days">Últimos 7 dias</option>
            <option value="30days">Últimos 30 dias</option>
          </select>

          {activeTab === 'sessions' && (
            <select className="w-full md:w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="all">Todos usuários</option>
              {Array.from(new Set(logs.map(l => l.user_id))).map(uid => (
                <option key={uid} value={uid}>{logs.find(l => l.user_id === uid)?.user?.name || `Usuário ${uid}`}</option>
              ))}
            </select>
          )}

          {activeTab === 'failed' && (
            <select className="w-full md:w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="all">Todos motivos</option>
              <option value="Credenciais">Credenciais inválidas</option>
              <option value="Bloqueado">Conta bloqueada</option>
            </select>
          )}

          <button
            onClick={exportToCSV}
            disabled={(activeTab === 'sessions' ? filteredLogs.length : filteredFailed.length) === 0}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'analytics' ? (
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-medium text-slate-500 mb-4">Logins nos últimos 7 dias</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.logins}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="logins" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-medium text-slate-500 mb-4">Tentativas Falhas nos últimos 7 dias</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData.failed}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="attempts" stroke="#e11d48" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-medium text-slate-500 mb-4">Top 5 Localizações</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topData.topLocations} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-medium text-slate-500 mb-4">Top 5 Dispositivos</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topData.topDevices} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'sessions' ? (
          filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Globe className="mx-auto mb-3 text-slate-300" size={32} />
              <p>Nenhum registro de acesso encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                    <th className="p-4 font-medium whitespace-nowrap">Usuário</th>
                    <th className="p-4 font-medium whitespace-nowrap">Ambiente</th>
                    <th className="p-4 font-medium whitespace-nowrap">Status</th>
                    <th className="p-4 font-medium whitespace-nowrap">Login / Último Acesso</th>
                    <th className="p-4 font-medium whitespace-nowrap">IP / Local / Dispositivo</th>
                    <th className="p-4 font-medium text-right whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredLogs.map((log) => {
                    const status = getSessionStatus(log)
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 whitespace-nowrap">
                          <div className="font-medium text-slate-900">{log.user?.name || 'Desconhecido'}</div>
                          <div className="text-xs text-slate-500">{log.user?.email}</div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.environment === 'production' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {log.environment === 'production' ? 'Produção' : 'Teste'}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${status.color}`}>
                            {status.icon}
                            {status.label}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-700 mb-1">
                            <Clock size={14} className="text-slate-400" />
                            {new Date(log.login_at).toLocaleString('pt-BR')}
                          </div>
                          <div className="text-xs text-slate-500">
                            Visto: {new Date(log.last_seen_at).toLocaleString('pt-BR')}
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-700 mb-1">
                            <Globe size={14} className="text-slate-400" />
                            {log.ip_address}
                          </div>
                          {log.location && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-1">
                              <MapPin size={12} className="text-slate-400" />
                              {log.location}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate max-w-[200px]" title={log.user_agent}>
                            {getDeviceIcon(log.user_agent)}
                            <span className="truncate">{log.user_agent}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleTrustDevice(log)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-medium transition-colors"
                              title="Marcar como Confiável"
                            >
                              <ShieldCheck size={14} />
                              Confiável
                            </button>
                            {status.label === 'Ativa' && (
                              <button
                                onClick={() => handleTerminateSession(log.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium transition-colors"
                              >
                                <XCircle size={14} />
                                Derrubar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredFailed.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <ShieldAlert className="mx-auto mb-3 text-slate-300" size={32} />
              <p>Nenhuma tentativa falha registrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                    <th className="p-4 font-medium whitespace-nowrap">E-mail Tentado</th>
                    <th className="p-4 font-medium whitespace-nowrap">Data / Hora</th>
                    <th className="p-4 font-medium whitespace-nowrap">Motivo</th>
                    <th className="p-4 font-medium whitespace-nowrap">IP / Dispositivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredFailed.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{attempt.email}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Clock size={14} className="text-slate-400" />
                          {new Date(attempt.attempted_at).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700">
                          {attempt.reason}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 mb-1">
                          <Globe size={14} className="text-slate-400" />
                          {attempt.ip_address}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate max-w-[200px]" title={attempt.user_agent}>
                          {getDeviceIcon(attempt.user_agent)}
                          <span className="truncate">{attempt.user_agent}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}

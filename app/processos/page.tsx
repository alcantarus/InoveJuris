'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import DashboardLayout from '../dashboard-layout'
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Eye,
  EyeOff,
  FileText,
  LayoutGrid,
  List,
  LockKeyhole,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Trash2,
  User,
} from 'lucide-react'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import { ModuleHeader } from '@/components/ModuleHeader'
import SyncDashboard from '@/components/SyncDashboard'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { cn, formatDate, normalizeSearchText } from '@/lib/utils'
import { getAppEnv } from '@/lib/env'
import { daysUntilDate, getNextDeadline, normalizeParties } from '@/lib/processes'
import { StrategicCockpit } from '@/components/processos/StrategicCockpit'
import { ProcessTable } from '@/components/processos/ProcessTable'
import { BentoProcessGrid } from '@/components/processos/BentoProcessGrid'
import { useAuth } from '@/lib/auth'
import { CurrencyInput } from '@/components/CurrencyInput'

interface Process {
  id: number
  number: string
  client: string
  court: string
  type: string
  status: string
  last_update?: string
  priority: string
  lawyer_id?: number | null
  history?: any[]
  process_deadlines?: any[]
  risk_assessment?: string
  tags?: any
  case_value?: number
  internal_notes?: string
  phase?: string | null
  comarca?: string | null
  tribunal?: string | null
  distribution_date?: string | null
  source?: string | null
  parties?: any
  secret_justice?: boolean
}

const DEFAULT_PROCESSES: Process[] = [
  { id: 1, number: '0012345-67.2023.8.26.0100', client: 'João Silva', court: 'TJSP - 2ª Vara Cível', type: 'Cível', status: 'Em Andamento', last_update: 'Há 2 dias', priority: 'Média' },
  { id: 2, number: '0098765-43.2023.5.02.0001', client: 'Empresa Tech Ltda', court: 'TRT2 - 1ª Vara do Trabalho', type: 'Trabalhista', status: 'Audiência Designada', last_update: 'Há 5 horas', priority: 'Alta' },
  { id: 3, number: '123.456.789-0', client: 'Maria Oliveira', court: 'INSS', type: 'Aposentadoria', status: 'Em Análise', last_update: 'Há 1 dia', priority: 'Alta' },
]

export default function ProcessosPage() {
  const { isVisible, toggleVisibility } = usePrivacy()
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [processes, setProcesses] = useState<Process[]>([])
  const [lawyers, setLawyers] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [lawAreas, setLawAreas] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'judicial' | 'previdenciario'>('judicial')
  const [editingProcess, setEditingProcess] = useState<Process | null>(null)
  const [isConsulting, setIsConsulting] = useState(false)
  const [syncingProcessId, setSyncingProcessId] = useState<number | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const [displayMode, setDisplayMode] = useState<'table' | 'cards'>('table')
  const [areaFilter, setAreaFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [responsibleFilter, setResponsibleFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'expired' | '7d'>('all')
  const [formData, setFormData] = useState({
    number: '',
    client: '',
    court: '',
    type: 'Cível',
    status: 'Em Andamento',
    priority: 'Média',
    risk_assessment: 'Possível',
    tags: [] as string[],
    case_value: 0,
    internal_notes: '',
    lawyer_id: null as number | null,
    phase: '',
    comarca: '',
    tribunal: '',
    distribution_date: '',
    source: 'Manual',
    parties: '',
    secret_justice: false,
    history: [] as any[],
    deadlines: [] as {id?: string, deadline_date: string, deadline_time?: string, description: string, status: string}[]
  })

  const fetchProcesses = async () => {
    if (!isSupabaseConfigured) {
      setMounted(true)
      return
    }

    const { data, error } = await supabase
      .from('processes')
      .select('*, process_deadlines(*)')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching processes:', error.message || error)
    }

    const { data: contractsData, error: contractsError } = await supabase
      .from('contracts')
      .select('processNumber, client_id')
    
    if (contractsError) {
      console.error('Error fetching contracts:', contractsError.message || contractsError)
    }

    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id, name')
      .order('name')
    
    if (clientsError) {
      console.error('Error fetching clients:', clientsError.message || clientsError)
    }

    const { data: lawyersData, error: lawyersError } = await supabase
      .from('lawyers')
      .select('id, user_id, name, users:user_id(name)')
    
    if (lawyersError) {
      console.error('Error fetching lawyers:', lawyersError.message || lawyersError)
    } else {
      setLawyers(lawyersData || [])
    }

    // Enrich processes with real client name if linked via contract
    const enrichedProcesses = (data || []).map((p: any) => {
      const contract = (contractsData || []).find((c: any) => c.processNumber === p.number);
      const client = contract ? (clientsData || []).find((cl: any) => cl.id === contract.client_id) : null;
      return {
        ...p,
        client: client ? client.name : p.client,
        tags: Array.isArray(p.tags) 
          ? p.tags 
          : (typeof p.tags === 'string' ? (p.tags as string).split(',').map(t => t.trim()) : [])
      };
    });

    setProcesses(enrichedProcesses)
    setClients(clientsData || [])

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, name, law_area_id')
    
    if (productsError) {
      console.error('Error fetching products:', productsError.message || productsError)
    } else {
      setProducts(productsData || [])
    }

    const { data: lawAreasData, error: lawAreasError } = await supabase
      .from('law_areas')
      .select('id, name')
    
    if (lawAreasError) {
      console.error('Error fetching law areas:', lawAreasError.message || lawAreasError)
    } else {
      setLawAreas(lawAreasData || [])
    }

    setMounted(true)
  }

  const createNotification = async (title: string, message: string, type: string = 'info') => {
    if (!isSupabaseConfigured || !user?.id) return
    
    try {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          title,
          message,
          type,
          user_id: user.id,
          read: false
        }])
      
      if (error) {
        console.error('Error creating notification:', error.message || error)
      }
    } catch (err) {
      console.error('Failed to create notification:', err)
    }
  }

  useEffect(() => {
    fetchProcesses()
  }, [])

  if (!mounted) return null

  const handleOpenModal = (mode: 'judicial' | 'previdenciario' = 'judicial', process?: Process) => {
    setModalMode(mode)
    
    const previdenciarioLawArea = lawAreas.find(la => la.name === 'Previdenciário');
    const previdenciarioProducts = products.filter(p => p.law_area_id === previdenciarioLawArea?.id);
    const defaultProduct = previdenciarioProducts.length > 0 ? previdenciarioProducts[0].name : '';

    if (process) {
      setEditingProcess(process)
      setFormData({
        number: process.number || '',
        client: process.client || '',
        court: process.court || '',
        type: process.type || (mode === 'previdenciario' ? defaultProduct : 'Cível'),
        status: process.status || (mode === 'previdenciario' ? 'Em Análise' : 'Em Andamento'),
        priority: process.priority || 'Média',
        risk_assessment: process.risk_assessment || 'Possível',
        tags: Array.isArray(process.tags) 
          ? process.tags 
          : (typeof process.tags === 'string' ? (process.tags as string).split(',').map(t => t.trim()) : []),
        case_value: process.case_value || 0,
        internal_notes: process.internal_notes || '',
        lawyer_id: process.lawyer_id || null,
        phase: process.phase || '',
        comarca: process.comarca || '',
        tribunal: process.tribunal || '',
        distribution_date: process.distribution_date ? String(process.distribution_date).slice(0, 10) : '',
        source: process.source || 'Manual',
        parties: normalizeParties(process.parties).map(p => [p.name, p.role, p.type].filter(Boolean).join(' | ')).join('\n'),
        secret_justice: process.secret_justice === true,
        history: process.history || [],
        deadlines: process.process_deadlines?.map(d => ({
          ...d,
          deadline_time: d.deadline_date?.includes('T') ? d.deadline_date.split('T')[1].substring(0, 5) : undefined,
          deadline_date: d.deadline_date?.includes('T') ? d.deadline_date.split('T')[0] : d.deadline_date
        })) || []
      })
    } else {
      setEditingProcess(null)
      setFormData({
        number: '',
        client: '',
        court: mode === 'previdenciario' ? 'INSS' : '',
        type: mode === 'previdenciario' ? defaultProduct : 'Cível',
        status: mode === 'previdenciario' ? 'Em Análise' : 'Em Andamento',
        priority: 'Média',
        risk_assessment: 'Possível',
        tags: [],
        case_value: 0,
        internal_notes: '',
        lawyer_id: null,
        phase: '',
        comarca: '',
        tribunal: '',
        distribution_date: '',
        source: 'Manual',
        parties: '',
        secret_justice: false,
        history: [],
        deadlines: []
      })
    }
    setClientSearch('')
    setIsClientDropdownOpen(false)
    setIsModalOpen(true)
  }

  const handleConsult = async () => {
    if (!formData.number) {
      alert('Informe o número do processo para consultar.')
      return
    }

    setIsConsulting(true)
    try {
      const response = await fetch('/api/process-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processNumber: formData.number })
      })

      const data = await response.json()
      if (data.success) {
        setFormData(prev => ({
          ...prev,
          court: data.court || prev.court,
          status: data.status || prev.status,
          history: data.history || prev.history
        }))
        alert('Consulta realizada com sucesso! Dados e histórico atualizados.')
      } else {
        alert(data.error || 'Erro ao consultar processo.')
      }
    } catch (error) {
      console.error('Error consulting process:', error)
      alert('Erro na comunicação com a API de consulta.')
    } finally {
      setIsConsulting(false)
    }
  }

  const handleSyncProcess = async (proc: Process) => {
    if (!proc.number) return
    
    setSyncingProcessId(proc.id)
    try {
      const response = await fetch('/api/process-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          process_id: proc.id,
          process_number: proc.number
        })
      })

      const data = await response.json()
      if (data.success) {
        alert(`Processo ${proc.number} sincronizado: ${data.movements} andamento(s) atualizado(s).`)
        fetchProcesses()
      } else {
        alert(`Erro ao sincronizar processo: ${data.error || 'Erro desconhecido'}`)
      }
    } catch (error) {
      console.error('Error syncing process:', error)
      alert('Erro na comunicação com a API de sincronização. Verifique sua conexão ou tente novamente mais tarde.')
    } finally {
      setSyncingProcessId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.client) {
      alert('Por favor, selecione um cliente.')
      return
    }
    
    const historyToSave = formData.history

    const processData = {
      number: formData.number,
      client: formData.client,
      court: modalMode === 'previdenciario' ? 'INSS' : formData.court,
      type: formData.type,
      status: formData.status,
      priority: formData.priority,
      risk_assessment: formData.risk_assessment,
      tags: formData.tags,
      case_value: formData.case_value,
      internal_notes: formData.internal_notes,
      lawyer_id: formData.lawyer_id || null,
      phase: formData.phase || null,
      comarca: formData.comarca || null,
      tribunal: formData.tribunal || null,
      distribution_date: formData.distribution_date || null,
      source: formData.source || 'Manual',
      secret_justice: formData.secret_justice,
      parties: formData.parties
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const [name, role, type] = line.split('|').map(part => part?.trim() || '')
          return { name, role: role || 'Parte', type }
        }),
      history: historyToSave.length > 0 ? historyToSave : (editingProcess?.history || []),
      last_update: new Date().toISOString(),
      updated_by: user?.id || null
    }

    if (editingProcess) {
      const { error } = await supabase
        .from('processes')
        .update(processData)
        .eq('id', editingProcess.id)
      
      if (error) {
        console.error('Error updating process:', error)
        alert(`Erro ao atualizar processo: ${error.message || 'Erro desconhecido'}`)
      } else {
        // Sync deadlines: Delete all existing and insert new ones
        console.log('Deleting deadlines for process_id:', editingProcess.id);
        const { data: deleteData, error: deleteError } = await supabase.from('process_deadlines').delete().eq('process_id', editingProcess.id);
        console.log('Delete result:', { deleteData, deleteError });

        const deadlinesToInsert = formData.deadlines.map(d => ({
          process_id: editingProcess.id,
          deadline_date: d.deadline_time ? `${d.deadline_date} ${d.deadline_time}:00` : d.deadline_date,
          description: d.description,
          status: d.status || 'Pendente',
          environment: getAppEnv()
        }));
        
        console.log('Inserting deadlines:', deadlinesToInsert);

        if (deadlinesToInsert.length > 0) {
          const { data: insertData, error: insertError } = await supabase.from('process_deadlines').insert(deadlinesToInsert);
          console.log('Insert result:', { insertData, insertError });
        }

        const updated = processes.map(p => p.id === editingProcess.id ? { ...p, ...processData } : p)
        setProcesses(updated)
        setIsModalOpen(false)
        fetchProcesses() // Refresh to get new deadlines
      }
    } else {
      (processData as any).created_by = user?.id || null
      const { data, error } = await supabase
        .from('processes')
        .insert([processData])
        .select()
      
      if (error) {
        console.error('Error creating process:', error)
        if (error.code === '23505') {
          alert('Este número de processo já está cadastrado no sistema.')
        } else {
          alert(`Erro ao criar processo: ${error.message || 'Erro desconhecido'}`)
        }
      } else {
        if (data && data.length > 0) {
          const newProcessId = data[0].id
          
          // Insert deadlines
          if (formData.deadlines.length > 0) {
            const deadlinesToInsert = formData.deadlines.map(d => ({
              process_id: newProcessId,
              deadline_date: d.deadline_time ? `${d.deadline_date} ${d.deadline_time}:00` : d.deadline_date,
              description: d.description,
              status: d.status || 'Pendente',
              environment: getAppEnv()
            }))
            const { error: insertError } = await supabase.from('process_deadlines').insert(deadlinesToInsert)
            
            if (!insertError) {
              for (let i = 0; i < deadlinesToInsert.length; i++) {
                const d = deadlinesToInsert[i];
                const originalD = formData.deadlines[i];
                await createNotification(
                  'Novo Prazo Cadastrado',
                  `Um novo prazo "${d.description}" foi cadastrado para o processo ${formData.number} para o dia ${formatDate(d.deadline_date)}${originalD.deadline_time ? ` às ${originalD.deadline_time}` : ''}.`,
                  'warning'
                );
              }
            }
          }
          
          setProcesses([{ ...data[0] }, ...processes])
          fetchProcesses() // Refresh to get new deadlines
        }
        setIsModalOpen(false)
      }
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Deseja excluir este processo?')) {
      const { error } = await supabase
        .from('processes')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error('Error deleting process:', error)
        alert('Erro ao excluir processo.')
      } else {
        const updated = processes.filter(p => String(p.id) !== String(id))
        setProcesses(updated)
      }
    }
  }

  const normalizedSearchTerm = normalizeSearchText(searchTerm)
  const areaOptions = Array.from(new Set(processes.map(p => p.type).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  const statusOptions = Array.from(new Set(processes.map(p => p.status).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  const responsibleOptions = Array.from(new Set(processes.map(p => {
    if (p.lawyer_id == null) return ''
    const lawyer = lawyers.find(l => Number(l.id) === Number(p.lawyer_id))
    return lawyer?.name || lawyer?.users?.name || ''
  }).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))

  const filteredProcesses = processes.filter(p => {
    const partyNames = normalizeParties(p.parties).map(part => part.name).join(' ')
    const lawyer = p.lawyer_id != null ? lawyers.find(l => Number(l.id) === Number(p.lawyer_id)) : null
    const responsible = lawyer?.name || lawyer?.users?.name || ''
    const matchesSearch = !normalizedSearchTerm ||
      normalizeSearchText(p.number).includes(normalizedSearchTerm) ||
      normalizeSearchText(p.client).includes(normalizedSearchTerm) ||
      normalizeSearchText(p.court).includes(normalizedSearchTerm) ||
      normalizeSearchText(partyNames).includes(normalizedSearchTerm) ||
      normalizeSearchText(responsible).includes(normalizedSearchTerm)
    if (!matchesSearch) return false
    if (areaFilter && p.type !== areaFilter) return false
    if (statusFilter && p.status !== statusFilter) return false
    if (responsibleFilter && responsible !== responsibleFilter) return false

    if (urgencyFilter !== 'all') {
      const next = getNextDeadline(p)
      if (!next) return false
      const days = daysUntilDate(next.deadline_date)
      if (urgencyFilter === 'expired' && days >= 0) return false
      if (urgencyFilter === '7d' && (days < 0 || days > 7)) return false
    }
    return true
  })

  // Contagens reais de prazos (a antiga getNearestDeadlineStatus era um stub).
  const expiredCount = processes.filter(p => {
    const next = getNextDeadline(p)
    return next ? daysUntilDate(next.deadline_date) < 0 : false
  }).length
  const criticalCount = processes.filter(p => {
    const next = getNextDeadline(p)
    if (!next) return false
    const days = daysUntilDate(next.deadline_date)
    return days >= 0 && days <= 7
  }).length

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <ModuleHeader 
          icon={Scale}
          title="Processos" 
          description="Acompanhe o andamento de todas as causas."
        />
        
        <SyncDashboard />

        <div className="flex flex-wrap gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-1 flex items-center shadow-sm mr-2">
            <button
              onClick={() => setDisplayMode('table')}
              title="Visão em tabela"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                displayMode === 'table' ? "bg-slate-100 text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <List size={15} /> Lista
            </button>
            <button
              onClick={() => setDisplayMode('cards')}
              title="Visão em cards"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                displayMode === 'cards' ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <LayoutGrid size={15} /> Cards
            </button>
          </div>
          <button 
            onClick={() => handleOpenModal('judicial')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Scale size={20} />
            <span className="hidden sm:inline">Novo Judicial</span>
            <span className="inline sm:hidden">Judicial</span>
          </button>
          <button 
            onClick={() => handleOpenModal('previdenciario')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <FileText size={20} />
            <span className="hidden sm:inline">Novo Previdenciário</span>
            <span className="inline sm:hidden">INSS</span>
          </button>
          <button 
            onClick={() => toggleVisibility('process_all')}
            className="p-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 text-sm font-bold shadow-sm"
            title={isVisible('process_all') ? "Ocultar valores" : "Mostrar valores"}
          >
            {isVisible('process_all') ? <Eye size={18} className="text-indigo-600" /> : <EyeOff size={18} className="text-slate-400" />}
            <span className="hidden sm:inline">{isVisible('process_all') ? "Ocultar Valores" : "Mostrar Valores"}</span>
          </button>
        </div>

        {/* Deadline Alerts Banner */}
        {(criticalCount > 0 || expiredCount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {expiredCount > 0 && (
              <button
                type="button"
                onClick={() => setUrgencyFilter(urgencyFilter === 'expired' ? 'all' : 'expired')}
                className={cn(
                  "p-4 rounded-xl border flex items-center gap-4 cursor-pointer transition-all text-left",
                  urgencyFilter === 'expired' ? "bg-red-50 border-red-300 shadow-sm" : "bg-white border-red-100 hover:bg-red-50/50"
                )}
              >
                <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-600">Prazos vencidos</p>
                  <p className="text-2xl font-bold text-red-700">{expiredCount}</p>
                </div>
              </button>
            )}
            {criticalCount > 0 && (
              <button
                type="button"
                onClick={() => setUrgencyFilter(urgencyFilter === '7d' ? 'all' : '7d')}
                className={cn(
                  "p-4 rounded-xl border flex items-center gap-4 cursor-pointer transition-all text-left",
                  urgencyFilter === '7d' ? "bg-orange-50 border-orange-300 shadow-sm" : "bg-white border-orange-100 hover:bg-orange-50/50"
                )}
              >
                <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
                  <CalendarClock size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-600">Vencem em até 7 dias</p>
                  <p className="text-2xl font-bold text-orange-700">{criticalCount}</p>
                </div>
              </button>
            )}
          </div>
        )}

        {!isSupabaseConfigured && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800">
            <AlertTriangle className="text-amber-500 shrink-0" size={20} />
            <p className="text-sm">
              <strong>Supabase não configurado:</strong> Configure as variáveis de ambiente 
              <code className="mx-1 bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> e 
              <code className="mx-1 bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 
              no painel do AI Studio para que os dados sejam salvos.
            </p>
          </div>
        )}

        <StrategicCockpit processes={filteredProcesses} isVisible={isVisible} />

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por cliente, CNJ, vara ou parte adversa..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="">Todas as áreas</option>
              {areaOptions.map(area => <option key={area} value={area}>{area}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="">Todas as situações</option>
              {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <select
              value={responsibleFilter}
              onChange={(e) => setResponsibleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="">Todos os responsáveis</option>
              {responsibleOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <span className="ml-auto text-xs font-semibold text-slate-500">
              {filteredProcesses.length} {filteredProcesses.length === 1 ? 'processo' : 'processos'}
            </span>
            {(searchTerm || areaFilter || statusFilter || responsibleFilter || urgencyFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setAreaFilter('')
                  setStatusFilter('')
                  setResponsibleFilter('')
                  setUrgencyFilter('all')
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {displayMode === 'table' ? (
          <ProcessTable
            processes={filteredProcesses}
            lawyers={lawyers}
            isVisible={isVisible}
            syncingId={syncingProcessId}
            onEdit={(p) => handleOpenModal(p.court === 'INSS' ? 'previdenciario' : 'judicial', p)}
            onDelete={handleDelete}
            onSync={handleSyncProcess}
          />
        ) : (
          <BentoProcessGrid
            processes={filteredProcesses}
            onEdit={(p) => handleOpenModal(p.court === 'INSS' ? 'previdenciario' : 'judicial', p)}
            onDelete={handleDelete}
            onSync={handleSyncProcess}
            syncingId={syncingProcessId}
            lawyers={lawyers}
            isVisible={isVisible}
          />
        )}

        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingProcess ? 'Editar Processo' : (modalMode === 'previdenciario' ? 'Novo Processo Previdenciário' : 'Novo Processo Judicial')}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {modalMode === 'previdenciario' ? 'Número do Protocolo / Benefício' : 'Número do Processo'}
              </label>
              <div className="flex gap-2">
                <input 
                  required
                  type="text" 
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder={modalMode === 'previdenciario' ? "000.000.000-0" : "0000000-00.0000.0.00.0000"}
                  value={formData.number}
                  onChange={e => setFormData({ ...formData, number: e.target.value })}
                />
                {modalMode === 'judicial' && (
                  <button
                    type="button"
                    onClick={handleConsult}
                    disabled={isConsulting}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isConsulting ? <Clock size={18} className="animate-spin" /> : <Search size={18} />}
                    Consultar
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
              <div className="relative">
                <div 
                  onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white cursor-pointer flex items-center justify-between"
                >
                  <span className={formData.client ? 'text-slate-900' : 'text-slate-400'}>
                    {formData.client || 'Selecione um cliente...'}
                  </span>
                  <User size={18} className="text-slate-400" />
                </div>

                {isClientDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="p-2 border-bottom bg-slate-50">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                          type="text"
                          placeholder="Buscar cliente..."
                          className="w-full pl-8 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          value={clientSearch}
                          onChange={e => setClientSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {(() => {
                        const normalizedClientSearch = normalizeSearchText(clientSearch)
                        const filteredModalClients = clients.filter(c =>
                          !normalizedClientSearch || normalizeSearchText(c.name).includes(normalizedClientSearch)
                        )
                        return (
                          <>
                            {filteredModalClients.map(c => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setFormData({ ...formData, client: c.name })
                                  setIsClientDropdownOpen(false)
                                  setClientSearch('')
                                }}
                                className="px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer transition-colors"
                              >
                                {c.name}
                              </div>
                            ))}
                            {filteredModalClients.length === 0 && (
                              <div className="px-4 py-3 text-sm text-slate-500 text-center italic">
                                Nenhum cliente encontrado
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {modalMode === 'judicial' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tribunal / Vara</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={formData.court}
                  onChange={e => setFormData({ ...formData, court: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fase</label>
                <input
                  type="text"
                  placeholder="Ex.: Instrução"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={formData.phase}
                  onChange={e => setFormData({ ...formData, phase: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Comarca</label>
                <input
                  type="text"
                  placeholder="Ex.: São Paulo/SP"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={formData.comarca}
                  onChange={e => setFormData({ ...formData, comarca: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tribunal</label>
                <input
                  type="text"
                  placeholder="Ex.: TJSP"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={formData.tribunal}
                  onChange={e => setFormData({ ...formData, tribunal: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Distribuição</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={formData.distribution_date}
                  onChange={e => setFormData({ ...formData, distribution_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Advogado Responsável</label>
              <select 
                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                value={formData.lawyer_id || ''}
                onChange={e => setFormData({ ...formData, lawyer_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Selecione um advogado...</option>
                {lawyers.map(l => (
                  <option key={l.id} value={l.id}>{l.users?.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                {modalMode === 'previdenciario' ? (
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                  >
                    {products
                      .filter(p => p.law_area_id === lawAreas.find(la => la.name === 'Previdenciário')?.id)
                      .map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))
                    }
                    {products.filter(p => p.law_area_id === lawAreas.find(la => la.name === 'Previdenciário')?.id).length === 0 && (
                      <option disabled>Nenhum produto previdenciário cadastrado</option>
                    )}
                  </select>
                ) : (
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option>Cível</option>
                    <option>Trabalhista</option>
                    <option>Previdenciário (Judicial)</option>
                    <option>Família</option>
                    <option>Criminal</option>
                    <option>Tributário</option>
                    <option>Empresarial</option>
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option>Baixa</option>
                  <option>Média</option>
                  <option>Alta</option>
                </select>
              </div>
            </div>
             <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                {modalMode === 'previdenciario' ? (
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option>Em Análise</option>
                    <option>Exigência</option>
                    <option>Deferido</option>
                    <option>Indeferido</option>
                    <option>Recurso Administrativo</option>
                    <option>Concluído</option>
                  </select>
                ) : (
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option>Em Andamento</option>
                    <option>Audiência Designada</option>
                    <option>Concluso para Sentença</option>
                    <option>Aguardando Prazo</option>
                    <option>Arquivado</option>
                    <option>Suspenso</option>
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Risco (Probabilidade)</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  value={formData.risk_assessment || 'Possível'}
                  onChange={e => setFormData({ ...formData, risk_assessment: e.target.value })}
                >
                  <option>Provável</option>
                  <option>Possível</option>
                  <option>Remoto</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor da Causa (R$)</label>
              <CurrencyInput 
                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                value={formData.case_value || 0}
                onChange={(val: number) => setFormData({ ...formData, case_value: val })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tags (separadas por vírgula)</label>
              <input 
                type="text"
                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="Ex: Urgente, Alvará, Recurso"
                value={formData.tags.join(', ')}
                onChange={e => setFormData({ ...formData, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fonte de Cadastro</label>
                <select
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  value={formData.source}
                  onChange={e => setFormData({ ...formData, source: e.target.value })}
                >
                  <option>Manual</option>
                  <option>DataJud</option>
                  <option>DJEN</option>
                  <option>Comunica PJe</option>
                </select>
              </div>
              <label className="flex items-center gap-2 self-end px-4 py-2.5 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                <LockKeyhole size={16} className="text-rose-500" />
                <input
                  type="checkbox"
                  checked={formData.secret_justice}
                  onChange={e => setFormData({ ...formData, secret_justice: e.target.checked })}
                  className="accent-indigo-600"
                />
                <span className="text-sm font-medium text-slate-700">Segredo de justiça</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Partes <span className="text-xs font-normal text-slate-400">(uma por linha: Nome | Papel | Tipo)</span>
              </label>
              <textarea
                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-xs"
                rows={3}
                placeholder={'Construtora Aurora Ltda | Cliente | PJ\nBanco Meridional S.A. | Parte adversa | PJ'}
                value={formData.parties}
                onChange={e => setFormData({ ...formData, parties: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notas Internas</label>
              <textarea 
                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                rows={3}
                value={formData.internal_notes || ''}
                onChange={e => setFormData({ ...formData, internal_notes: e.target.value })}
              />
            </div>

            {/* Prazos do Processo */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-700">Prazos do Processo</h4>
                <button 
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    deadlines: [...formData.deadlines, { deadline_date: '', description: '', status: 'Pendente' }]
                  })}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Plus size={14} /> Adicionar Prazo
                </button>
              </div>
              
              <div className="space-y-3">
                {formData.deadlines.map((d, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data</label>
                      <input 
                        type="date"
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={d.deadline_date}
                        onChange={e => {
                          const newDeadlines = [...formData.deadlines]
                          newDeadlines[index].deadline_date = e.target.value
                          setFormData({ ...formData, deadlines: newDeadlines })
                        }}
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hora</label>
                      <input 
                        type="time"
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={d.deadline_time || ''}
                        onChange={e => {
                          const newDeadlines = [...formData.deadlines]
                          newDeadlines[index].deadline_time = e.target.value
                          setFormData({ ...formData, deadlines: newDeadlines })
                        }}
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição</label>
                      <input 
                        type="text"
                        placeholder="Ex: Contestação"
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={d.description}
                        onChange={e => {
                          const newDeadlines = [...formData.deadlines]
                          newDeadlines[index].description = e.target.value
                          setFormData({ ...formData, deadlines: newDeadlines })
                        }}
                      />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button 
                        type="button"
                        onClick={() => {
                          const newDeadlines = formData.deadlines.filter((_, i) => i !== index)
                          setFormData({ ...formData, deadlines: newDeadlines })
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {formData.deadlines.length === 0 && (
                  <p className="text-xs text-slate-400 text-center italic">Nenhum prazo adicional definido.</p>
                )}
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
              >
                {editingProcess ? 'Salvar Alterações' : 'Criar Processo'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  )
}


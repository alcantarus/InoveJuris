'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import {
  Archive,
  CheckCircle2,
  Download,
  EyeOff,
  FileSearch,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { KPICard } from '@/components/ui/KPICard'
import { PublicationTable } from '@/components/publicacoes/PublicationTable'
import { PublicationDetail } from '@/components/publicacoes/PublicationDetail'
import { NewPublicationModal, SyncModal } from '@/components/publicacoes/SyncModal'
import { matchesSearch } from '@/lib/utils'
import {
  countPublicationStatuses,
  exportPublicationsCsv,
  fetchPublications,
  type PublicationItem,
  type PublicationLawyerOption,
  type PublicationProcessOption,
  type PublicationStatus,
} from '@/lib/publications'

type Tab = PublicationStatus | 'Todas'

const TABS: Tab[] = ['A triar', 'Triada', 'Ignorada', 'Todas']

export default function PublicacoesPage() {
  const [items, setItems] = useState<PublicationItem[]>([])
  const [processes, setProcesses] = useState<PublicationProcessOption[]>([])
  const [lawyers, setLawyers] = useState<PublicationLawyerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('A triar')
  const [search, setSearch] = useState('')
  const [court, setCourt] = useState('')
  const [source, setSource] = useState('')
  const [selected, setSelected] = useState<PublicationItem | null>(null)
  const [syncOpen, setSyncOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)

  const load = useCallback(async (showToast = false) => {
    setLoading(true)
    const payload = await fetchPublications()
    setItems(payload.items)
    setProcesses(payload.processes)
    setLawyers(payload.lawyers)
    if (payload.error) {
      toast.error('Não foi possível carregar as publicações.', { description: payload.error })
    } else if (showToast) {
      toast.success('Fila de publicações atualizada.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => countPublicationStatuses(items), [items])
  const total = items.length

  const courts = useMemo(
    () => Array.from(new Set(items.map(item => item.court).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items]
  )
  const sources = useMemo(
    () => Array.from(new Set(items.map(item => item.source).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items]
  )

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (tab !== 'Todas' && item.status !== tab) return false
      if (court && item.court !== court) return false
      if (source && item.source !== source) return false
      if (!matchesSearch(
        search,
        item.processNumber,
        item.clientName,
        item.court,
        item.unit,
        item.content,
        item.responsibleName,
        item.decisionNotes,
        item.recipients.map(recipient => `${recipient.name} ${recipient.lawyer || ''}`).join(' ')
      )) return false
      return true
    })
  }, [items, tab, court, source, search])

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.info('Nenhuma publicação para exportar.')
      return
    }
    exportPublicationsCsv(filtered)
    toast.success(`${filtered.length} ${filtered.length === 1 ? 'publicação exportada' : 'publicações exportadas'} em CSV.`)
  }

  const openDetails = (item: PublicationItem) => setSelected(item)

  const handleChanged = () => {
    load()
    setSelected(null)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <ModuleHeader
            title="Publicações"
            description="Fila única do DJEN, Comunica PJe e e-mail. A triagem é humana: o sistema sugere, o advogado confirma."
            icon={FileSearch}
          />
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => load(true)}
              title="Atualizar fila"
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download size={16} /> Exportar CSV
            </button>
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus size={16} /> Nova publicação
            </button>
            <button
              type="button"
              onClick={() => setSyncOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm"
            >
              <RefreshCw size={16} /> Sincronizar DJEN
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <KPICard title="A triar" value={counts['A triar']} icon={Inbox} color="amber" />
          <KPICard title="Triadas" value={counts.Triada} icon={CheckCircle2} color="emerald" />
          <KPICard title="Ignoradas" value={counts.Ignorada} icon={EyeOff} color="slate" />
          <KPICard title="Todas" value={total} icon={Archive} color="indigo" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-2xl border border-indigo-200 bg-indigo-50"
        >
          <ShieldCheck className="text-indigo-600 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-bold text-indigo-900">Regra do escritório</p>
            <p className="text-xs text-indigo-800 mt-0.5">
              Nenhum prazo é criado automaticamente a partir de uma publicação. A importação apenas alimenta a fila;
              a criação do prazo exige leitura, classificação e confirmação expressa do advogado responsável.
            </p>
          </div>
        </motion.div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 pt-3 border-b border-slate-100">
            <div className="flex flex-wrap gap-1">
              {TABS.map(option => {
                const count = option === 'Todas' ? total : counts[option]
                const active = tab === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTab(option)}
                    className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
                      active
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {option} <span className="text-xs opacity-70">({count})</span>
                  </button>
                )
              })}
            </div>
            <span className="text-xs text-slate-500 pb-3">
              <strong className="text-slate-700">{filtered.length}</strong> {filtered.length === 1 ? 'publicação' : 'publicações'} nesta visão
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-slate-100">
            <div className="relative sm:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por CNJ, parte, tribunal ou texto..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <select value={court} onChange={e => setCourt(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400">
              <option value="">Todos os tribunais</option>
              {courts.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-indigo-400">
              <option value="">Todas as origens</option>
              {sources.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <PublicationTable items={filtered} onSelect={openDetails} />
        </div>
      </div>

      <PublicationDetail
        publication={selected}
        processes={processes}
        lawyers={lawyers}
        onClose={() => setSelected(null)}
        onChanged={handleChanged}
      />
      <SyncModal isOpen={syncOpen} onClose={() => setSyncOpen(false)} onSynced={() => load(true)} />
      <NewPublicationModal
        isOpen={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => load(true)}
        processOptions={processes}
      />
    </DashboardLayout>
  )
}

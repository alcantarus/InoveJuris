'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Save } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import { getTodayBR } from '@/lib/utils'

const COMMON_TRIBUNALS = ['TJSP', 'TJMG', 'TJRJ', 'TJBA', 'TRF1', 'TRF3', 'TRF4', 'TRT1', 'TRT2', 'TRT15']

function daysAgo(days: number): string {
  const date = new Date(`${getTodayBR()}T12:00:00`)
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface SyncModalProps {
  isOpen: boolean
  onClose: () => void
  onSynced: () => void
}

export function SyncModal({ isOpen, onClose, onSynced }: SyncModalProps) {
  const [form, setForm] = useState({
    startDate: daysAgo(7),
    endDate: getTodayBR(),
    tribunal: 'TJSP',
    processNumber: '',
    oab: '',
    ufOab: '',
    maxPages: '5',
  })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    if (isOpen) setResult(null)
  }, [isOpen])

  const update = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }))

  const handleSync = async () => {
    if (!form.startDate || !form.endDate || form.startDate > form.endDate) {
      toast.error('Confira o período: a data inicial não pode ser maior que a final.')
      return
    }
    if (!form.tribunal && !form.processNumber && !form.oab) {
      toast.error('Informe ao menos um filtro: tribunal, processo ou OAB.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/djen-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: form.startDate,
          endDate: form.endDate,
          tribunal: form.tribunal,
          processNumber: form.processNumber,
          oab: form.oab,
          ufOab: form.ufOab,
          pageSize: 100,
          maxPages: Number(form.maxPages) || 5,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível sincronizar com o DJEN.')
      }
      setResult(data)
      toast.success(`${data.inserted} novas publicações e ${data.updated} atualizações processadas.`)
      onSynced()
    } catch (error: any) {
      toast.error('Falha na sincronização.', { description: error?.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sincronizar com o DJEN" className="max-w-xl">
      <div className="space-y-4">
        <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50 text-xs text-indigo-800">
          A importação <strong>apenas alimenta a fila</strong>. Nenhum prazo é criado automaticamente: toda publicação
          exige leitura, classificação e confirmação expressa do advogado responsável.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">De</span>
            <input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Até</span>
            <input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Tribunal (sigla)</span>
            <input list="djen-tribunais" value={form.tribunal} onChange={e => update('tribunal', e.target.value)}
              placeholder="Ex.: TJSP" className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
            <datalist id="djen-tribunais">
              {COMMON_TRIBUNALS.map(tribunal => <option key={tribunal} value={tribunal} />)}
            </datalist>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Número do processo (opcional)</span>
            <input value={form.processNumber} onChange={e => update('processNumber', e.target.value)}
              placeholder="CNJ com ou sem máscara" className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">OAB (opcional)</span>
            <input value={form.oab} onChange={e => update('oab', e.target.value)} placeholder="Somente números"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">UF da OAB</span>
            <input value={form.ufOab} onChange={e => update('ufOab', e.target.value)} placeholder="SP" maxLength={2}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Páginas (máx. 20)</span>
            <input type="number" min={1} max={20} value={form.maxPages} onChange={e => update('maxPages', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
          </label>
        </div>

        {result && (
          <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 space-y-1">
            <p className="font-bold">Sincronização concluída</p>
            <p>{result.fetched} comunicações processadas em {result.pagesFetched} página(s).</p>
            <p>{result.inserted} novas · {result.updated} atualizações · {result.skipped} duplicatas ignoradas.</p>
            <p>{result.matchedProcesses} vincularam-se a processos cadastrados.</p>
            {result.rateLimitRemaining != null && <p className="text-emerald-700">Restam {result.rateLimitRemaining} requisições no limite do DJEN.</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Fechar
          </button>
          <button type="button" onClick={handleSync} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
            <RefreshCw size={15} className={saving ? 'animate-spin' : ''} />
            {saving ? 'Sincronizando...' : 'Buscar no DJEN'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

interface NewPublicationModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  processOptions: Array<{ id: number; number: string; client: string }>
}

export function NewPublicationModal({ isOpen, onClose, onCreated, processOptions }: NewPublicationModalProps) {
  const [form, setForm] = useState({
    source: 'Comunica PJe',
    process_id: '',
    process_number: '',
    court: '',
    unit: '',
    publication_date: getTodayBR(),
    importance: '',
    content: '',
  })
  const [saving, setSaving] = useState(false)

  const update = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }))

  const handleSave = async () => {
    if (!form.content.trim()) {
      toast.error('Informe o teor da publicação.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('publications').insert([{
        source: form.source,
        external_id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        process_id: form.process_id ? Number(form.process_id) : null,
        process_number: form.process_number.replace(/\D/g, '') || null,
        process_number_masked: form.process_number || null,
        court: form.court || null,
        unit: form.unit || null,
        publication_date: form.publication_date || null,
        importance: form.importance || null,
        chamber: 'Judicial',
        content: form.content.trim(),
        recipients: [],
        raw_payload: {},
        status: 'A triar',
      }])
      if (error) throw error
      toast.success('Publicação adicionada à fila.')
      onCreated()
      onClose()
      setForm({
        source: 'Comunica PJe', process_id: '', process_number: '', court: '', unit: '',
        publication_date: getTodayBR(), importance: '', content: '',
      })
    } catch (error: any) {
      toast.error('Não foi possível salvar a publicação.', { description: error?.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova publicação" className="max-w-xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Origem</span>
            <select value={form.source} onChange={e => update('source', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400">
              <option value="Comunica PJe">Comunica PJe</option>
              <option value="E-mail">E-mail</option>
              <option value="DJEN">DJEN</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Disponibilização</span>
            <input type="date" value={form.publication_date} onChange={e => update('publication_date', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-slate-600">Processo cadastrado (opcional)</span>
          <select value={form.process_id} onChange={e => update('process_id', e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400">
            <option value="">Não vincular agora</option>
            {processOptions.map(option => (
              <option key={option.id} value={option.id}>{option.number} — {option.client}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">CNJ (quando não vinculado)</span>
            <input value={form.process_number} onChange={e => update('process_number', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Importância (opcional)</span>
            <input value={form.importance} onChange={e => update('importance', e.target.value)} placeholder="Ex.: 5 dias"
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Tribunal</span>
            <input value={form.court} onChange={e => update('court', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Órgão / Unidade</span>
            <input value={form.unit} onChange={e => update('unit', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-slate-600">Teor da publicação</span>
          <textarea rows={6} value={form.content} onChange={e => update('content', e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400 resize-y" />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
            <Save size={15} /> {saving ? 'Salvando...' : 'Adicionar à fila'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

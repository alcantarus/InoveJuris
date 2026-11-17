'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Save } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import { cn, getTodayBR } from '@/lib/utils'
import { getAppEnv } from '@/lib/env'

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

interface LawyerOption {
  id: number
  name: string
  oab_number: string
  uf_oab: string
  label: string
  valid: boolean
}

export function SyncModal({ isOpen, onClose, onSynced }: SyncModalProps) {
  const [form, setForm] = useState({
    startDate: daysAgo(7),
    endDate: getTodayBR(),
    tribunal: '',
    processNumber: '',
    maxPages: '5',
  })
  const [lawyers, setLawyers] = useState<LawyerOption[]>([])
  const [selectedLawyerIds, setSelectedLawyerIds] = useState<number[]>([])
  const [loadingLawyers, setLoadingLawyers] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<any>(null)

  const loadLawyers = useCallback(async () => {
    setLoadingLawyers(true)
    try {
      const { data, error } = await supabase
        .from('lawyers')
        .select('id, name, oab_number, uf_oab, environment')
        .eq('environment', getAppEnv())
        .order('name')

      if (error) throw error

      const options: LawyerOption[] = (data || []).map((row: any) => {
        const oabNumber = String(row.oab_number || '').replace(/\D/g, '')
        const ufOab = String(row.uf_oab || '').trim().toUpperCase()
        const valid = /^\d{1,10}$/.test(oabNumber) && /^[A-Z]{2}$/.test(ufOab)
        const suffix = `${oabNumber}/${ufOab || '--'}`

        return {
          id: Number(row.id),
          name: row.name || '',
          oab_number: oabNumber,
          uf_oab: ufOab,
          label: row.name ? `${row.name} · ${suffix}` : suffix,
          valid,
        }
      })

      setLawyers(options)
      setSelectedLawyerIds(options.filter(lawyer => lawyer.valid).map(lawyer => lawyer.id))
    } catch (error: any) {
      toast.error('Não foi possível carregar os advogados cadastrados.', { description: error?.message })
    } finally {
      setLoadingLawyers(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setResult(null)
    loadLawyers()
  }, [isOpen, loadLawyers])

  const update = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }))

  const validSelectedLawyers = lawyers.filter(lawyer => lawyer.valid && selectedLawyerIds.includes(lawyer.id))
  const allSelected = validSelectedLawyers.length > 0 && validSelectedLawyers.every(lawyer => selectedLawyerIds.includes(lawyer.id))

  const toggleLawyer = (id: number) => {
    setSelectedLawyerIds(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id])
  }

  const toggleAll = () => {
    setSelectedLawyerIds(allSelected ? [] : validSelectedLawyers.map(lawyer => lawyer.id))
  }

  const handleSync = async () => {
    if (!form.startDate || !form.endDate || form.startDate > form.endDate) {
      toast.error('Confira o período: a data inicial não pode ser maior que a final.')
      return
    }
    if (validSelectedLawyers.length === 0) {
      toast.error('Selecione ao menos um advogado cadastrado com OAB e UF válidas.')
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
          lawyerIds: validSelectedLawyers.map(lawyer => lawyer.id),
          environment: getAppEnv(),
          pageSize: 100,
          maxPages: Number(form.maxPages) || 5,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível sincronizar com o DJEN.')
      }
      setResult(data)
      toast.success(`${data.inserted} novas publicações e ${data.updated} atualizações processadas para ${data.lawyersProcessed?.length || 0} advogado(s).`)
      onSynced()

      const warnings: string[] = []
      if (data.invalidLawyers?.length) warnings.push(`${data.invalidLawyers.length} cadastro(s) com OAB/UF inválida`)
      if (data.failedLawyers?.length) warnings.push(`${data.failedLawyers.length} advogado(s) falharam`)
      if (data.rateLimited) warnings.push('limite de requisições atingido — aguarde cerca de 1 minuto')
      if (warnings.length > 0) {
        toast.warning('Sincronização parcial.', { description: warnings.join(' · ') })
      }
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
          exige leitura, classificação e confirmação expressa do advogado responsável. O DJEN consultará a OAB/UF
          <strong> somente dos advogados cadastrados</strong> neste ambiente.
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
            <span className="text-xs font-bold text-slate-600">Tribunal (opcional)</span>
            <input list="djen-tribunais" value={form.tribunal} onChange={e => update('tribunal', e.target.value)}
              placeholder="Todos" className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
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

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <div>
              <p className="text-xs font-bold text-slate-700">Advogados cadastrados</p>
              <p className="text-[11px] text-slate-500">Um filtro OAB/UF por advogado selecionado.</p>
            </div>
            {lawyers.length > 1 && (
              <button type="button" onClick={toggleAll} disabled={loadingLawyers || validSelectedLawyers.length === 0}
                className="text-[11px] font-semibold text-indigo-600 hover:underline disabled:opacity-50">
                {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
              </button>
            )}
          </div>
          <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
            {loadingLawyers ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500">Carregando advogados...</p>
            ) : lawyers.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500">
                Nenhum advogado cadastrado neste ambiente. Cadastre um no Módulo Advogados.
              </p>
            ) : (
              lawyers.length === 1 ? (
                <div className="px-3 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-700">Advogado considerado</p>
                    <p className="text-sm text-slate-600">{lawyers[0].label}</p>
                    {!lawyers[0].valid && (
                      <p className="text-[11px] text-rose-600">OAB/UF incompleta — revise o cadastro.</p>
                    )}
                  </div>
                  {lawyers[0].valid && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                      Selecionado
                    </span>
                  )}
                </div>
              ) : (
                lawyers.map(lawyer => (
                  <label key={lawyer.id}
                    className={cn(
                      'flex items-start gap-2 px-3 py-2 text-sm',
                      lawyer.valid ? 'cursor-pointer hover:bg-slate-50' : 'opacity-60 cursor-not-allowed'
                    )}>
                    <input type="checkbox" className="mt-0.5 accent-indigo-600" checked={selectedLawyerIds.includes(lawyer.id)}
                      disabled={!lawyer.valid} onChange={() => toggleLawyer(lawyer.id)} />
                    <span>
                      <span className="block text-slate-700">{lawyer.label}</span>
                      {!lawyer.valid && (
                        <span className="block text-[11px] text-rose-600">OAB/UF incompleta — revise o cadastro.</span>
                      )}
                    </span>
                  </label>
                ))
              )
            )}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-slate-600">Páginas por advogado (máx. 20)</span>
          <input type="number" min={1} max={20} value={form.maxPages} onChange={e => update('maxPages', e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400" />
        </label>

        {result && (
          <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 space-y-1">
            <p className="font-bold">Sincronização concluída</p>
            <p>{result.fetched} comunicações processadas em {result.pagesFetched} página(s) para {result.lawyersProcessed?.length || 0} advogado(s).</p>
            <p>{result.inserted} novas · {result.updated} atualizações · {result.skipped} duplicatas ignoradas.</p>
            <p>{result.matchedProcesses} vincularam-se a processos cadastrados.</p>
            {result.failedLawyers?.length > 0 && (
              <p className="text-amber-700">{result.failedLawyers.length} advogado(s) não foram processados nesta rodada.</p>
            )}
            {result.rateLimited && (
              <p className="text-amber-700">Limite do DJEN atingido. Aguarde cerca de 1 minuto antes de tentar novamente.</p>
            )}
            {result.rateLimitRemaining != null && <p className="text-emerald-700">Restam {result.rateLimitRemaining} requisições no limite do DJEN.</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Fechar
          </button>
          <button type="button" onClick={handleSync} disabled={saving || loadingLawyers || validSelectedLawyers.length === 0}
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

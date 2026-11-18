'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Search, UserCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getAppEnv } from '@/lib/env'

export interface GuardianCandidate {
  id: number
  name: string
  document: string | null
}

interface GuardianPickerProps {
  excludeId?: number | null
  initialQuery?: string
  onSelect: (candidate: GuardianCandidate) => void
}

/** Busca clientes do mesmo ambiente para vincular como responsável legal. */
export function GuardianPicker({ excludeId, initialQuery = '', onSelect }: GuardianPickerProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<GuardianCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        let request = supabase
          .from('clients')
          .select('id, name, document')
          .eq('environment', getAppEnv())
          .ilike('name', `%${term}%`)
          .order('name')
          .limit(20)
        if (excludeId) request = request.neq('id', excludeId)
        const { data, error } = await request
        if (error) throw error
        if (!cancelled) setResults(data || [])
      } catch (error) {
        if (!cancelled) setResults([])
        console.error('Erro ao buscar responsável legal:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, excludeId])

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={event => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Pesquisar responsável pelo nome..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-400"
        />
        {loading && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-500" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {results.map(client => (
            <button
              key={client.id}
              type="button"
              onClick={() => {
                onSelect(client)
                setOpen(false)
                setQuery('')
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-indigo-50"
            >
              <UserCheck size={15} className="text-indigo-500 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-semibold">{client.name}</span>
              {client.document && <span className="text-xs font-mono text-slate-400 shrink-0">{client.document}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

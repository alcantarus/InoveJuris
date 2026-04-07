'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, User, Briefcase, DollarSign, Loader2, Scale } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (query.length < 3) return

    const fetchResults = async () => {
      setLoading(true)
      try {
        // Buscar clientes
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name')
          .ilike('name', `%${query}%`)
          .limit(3)
          
        // Buscar processos
        const { data: processesData } = await supabase
          .from('processes')
          .select('id, number')
          .ilike('number', `%${query}%`)
          .limit(3)

        // Buscar contratos (financeiro)
        const { data: contractsData } = await supabase
          .from('contracts')
          .select('id, clients(name)')
          .ilike('clients.name', `%${query}%`)
          .limit(3)

        const combinedResults = [
          ...(clientsData?.map((c: any) => ({ type: 'client', id: c.id, title: c.name, link: `/clientes/${c.id}` })) || []),
          ...(processesData?.map((p: any) => ({ type: 'process', id: p.id, title: `Processo: ${p.number}`, link: `/processos` })) || []),
          ...(contractsData?.map((c: any) => ({ 
            type: 'contract', 
            id: c.id, 
            title: `Financeiro: ${Array.isArray(c.clients) ? (c.clients[0]?.name || 'Sem cliente') : (c.clients?.name || 'Sem cliente')}`, 
            link: `/financeiro` 
          })) || [])
        ]
        
        setResults(combinedResults)
      } catch (error) {
        console.error('Error fetching search results:', error)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(fetchResults, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center pt-20"
          onClick={() => setIsOpen(false)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center px-4 border-b border-slate-100">
              <Search className="text-slate-400" size={20} />
              <input 
                autoFocus
                type="text"
                className="w-full px-4 py-4 outline-none text-slate-900 placeholder:text-slate-400"
                placeholder="Buscar clientes, processos..."
                value={query}
                onChange={e => {
                  const val = e.target.value
                  setQuery(val)
                  if (val.length < 3) {
                    setResults([])
                  }
                }}
              />
              {loading && <Loader2 className="animate-spin text-indigo-600" size={20} />}
            </div>
            <div className="p-2 max-h-96 overflow-y-auto">
              {results.length === 0 && query.length >= 3 && !loading && (
                <div className="px-3 py-3 text-sm text-slate-500 text-center">Nenhum resultado encontrado.</div>
              )}
              {results.map((result, index) => (
                <button 
                  key={index}
                  onClick={() => {
                    router.push(result.link)
                    setIsOpen(false)
                    setQuery('')
                    setResults([])
                  }}
                  className="w-full px-3 py-3 text-left flex items-center gap-3 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  {result.type === 'client' ? (
                    <User size={18} className="text-indigo-500" />
                  ) : result.type === 'process' ? (
                    <Scale size={18} className="text-emerald-500" />
                  ) : (
                    <DollarSign size={18} className="text-amber-500" />
                  )}
                  <span className="text-slate-700">{result.title}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

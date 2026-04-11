'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Disease {
  id: string
  cid_code: string
  description: string
}

interface DiseaseSelectorProps {
  selectedDiseases: Disease[]
  onDiseaseSelect: (disease: Disease) => void
  onDiseaseRemove: (diseaseId: string) => void
}

export function DiseaseSelector({ selectedDiseases, onDiseaseSelect, onDiseaseRemove }: DiseaseSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<Disease[]>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (searchTerm.length <= 1) {
      return
    }

    const fetchDiseases = async () => {
      const { data } = await supabase
        .from('diseases')
        .select('*')
        .or(`cid_code.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .limit(5)
      setSuggestions(data || [])
      setIsOpen(true)
    }
    fetchDiseases()
  }, [searchTerm])

  return (
    <div className="relative w-full">
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedDiseases.map((disease) => (
          <span key={disease.id} className="flex items-center gap-1 bg-indigo-100 text-indigo-800 px-2 py-1 rounded-md text-sm">
            {disease.cid_code} - {disease.description}
            <button onClick={() => onDiseaseRemove(disease.id)} className="hover:text-indigo-900">
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
        <input
          type="text"
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="Buscar doença por CID ou descrição..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            if (e.target.value.length <= 1) {
              setSuggestions([])
              setIsOpen(false)
            }
          }}
        />
        {isOpen && suggestions.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
            {suggestions.map((disease) => (
              <li
                key={disease.id}
                className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                onClick={() => {
                  onDiseaseSelect(disease)
                  setSearchTerm('')
                  setIsOpen(false)
                }}
              >
                {disease.cid_code} - {disease.description}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

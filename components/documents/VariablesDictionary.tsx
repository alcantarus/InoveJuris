'use client'

import React, { useState } from 'react'
import { Search, Copy, Check, BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { DOCUMENT_VARIABLES, VariableCategory, DocumentVariable } from '@/lib/document-variables'
import { motion, AnimatePresence } from 'motion/react'
import { cn, removeAccents } from '@/lib/utils'

interface VariablesDictionaryProps {
  isOpen: boolean
  onClose: () => void
}

export function VariablesDictionary({ isOpen, onClose }: VariablesDictionaryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedTag, setCopiedTag] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(DOCUMENT_VARIABLES.map(c => c.id))

  const handleCopy = (tag: string) => {
    navigator.clipboard.writeText(tag)
    setCopiedTag(tag)
    setTimeout(() => setCopiedTag(null), 2000)
  }

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const filteredCategories = DOCUMENT_VARIABLES.map(category => {
    const term = removeAccents(searchTerm).toLowerCase()
    const filteredVars = category.variables.filter(v => 
      removeAccents(v.label.toLowerCase()).includes(term) ||
      removeAccents(v.tag.toLowerCase()).includes(term) ||
      removeAccents(v.description.toLowerCase()).includes(term)
    )
    return { ...category, variables: filteredVars }
  }).filter(category => category.variables.length > 0)

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Dicionário de Variáveis"
      width="w-full max-w-md md:max-w-lg"
    >
      <div className="space-y-6 pb-20">
        {/* Header / Intro */}
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-800 flex gap-3">
          <BookOpen className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-medium mb-1">Como usar:</p>
            <p className="opacity-90">
              Copie as variáveis abaixo e cole no seu documento Word (.docx). 
              O sistema substituirá automaticamente pelos dados reais ao gerar o documento.
              <br/>
              <strong>Dica:</strong> As variáveis devem estar sempre entre colchetes duplos, como <code>{'[[variavel]]'}</code>.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar variável (ex: nome, cpf, processo...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>

        {/* Variables List */}
        <div className="space-y-4">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>Nenhuma variável encontrada para &quot;{searchTerm}&quot;</p>
            </div>
          ) : (
            filteredCategories.map(category => (
              <div key={category.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                >
                  <span className="font-semibold text-slate-700">{category.title}</span>
                  {expandedCategories.includes(category.id) ? (
                    <ChevronDown size={18} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-400" />
                  )}
                </button>
                
                <AnimatePresence>
                  {expandedCategories.includes(category.id) && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-slate-100">
                        {category.variables.map((variable) => (
                          <div 
                            key={variable.tag} 
                            className="p-4 hover:bg-slate-50 transition-colors group flex items-start justify-between gap-4"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-slate-900">{variable.label}</span>
                                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-slate-600 border border-slate-200">
                                  {variable.tag}
                                </code>
                              </div>
                              <p className="text-xs text-slate-500">{variable.description}</p>
                            </div>
                            
                            <button
                              onClick={() => handleCopy(variable.tag)}
                              className={cn(
                                "p-2 rounded-lg transition-all shrink-0",
                                copiedTag === variable.tag 
                                  ? "bg-emerald-100 text-emerald-700" 
                                  : "bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 focus:opacity-100"
                              )}
                              title="Copiar variável"
                            >
                              {copiedTag === variable.tag ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </div>
    </Drawer>
  )
}

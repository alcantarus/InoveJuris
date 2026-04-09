'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { Search, Plus, Trash2, Edit2, AlertTriangle, Stethoscope } from 'lucide-react'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { formatDate, removeAccents } from '@/lib/utils'

interface Disease {
  id: string
  cid_code: string
  description: string
  accessory_cids: string[]
}

export default function DoencasPage() {
  const { user } = useAuth()
  const [diseases, setDiseases] = useState<Disease[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDisease, setEditingDisease] = useState<Disease | null>(null)
  const [formData, setFormData] = useState<Partial<Disease>>({
    cid_code: '',
    description: '',
    accessory_cids: []
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setMounted(true)
        return
      }

      const { data, error } = await supabase.from('diseases').select('*').order('cid_code')
      if (error) console.error('Error fetching diseases:', error)
      else setDiseases(data || [])
      setMounted(true)
    }
    fetchData()
  }, [])

  const handleOpenModal = (disease?: Disease) => {
    if (disease) {
      setEditingDisease(disease)
      setFormData(disease)
    } else {
      setEditingDisease(null)
      setFormData({ cid_code: '', description: '', accessory_cids: [] })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured) return

    const diseaseData = {
      cid_code: formData.cid_code,
      description: formData.description,
      accessory_cids: formData.accessory_cids
    }

    if (editingDisease) {
      const { data, error } = await supabase
        .from('diseases')
        .update(diseaseData)
        .eq('id', editingDisease.id)
        .select()
      
      if (error) {
        console.error('Error updating disease:', error)
        alert('Erro ao atualizar doença.')
      } else {
        if (data) setDiseases(prev => prev.map(d => d.id === editingDisease.id ? data[0] : d))
        setIsModalOpen(false)
      }
    } else {
      const { data, error } = await supabase
        .from('diseases')
        .insert([diseaseData])
        .select()
      
      if (error) {
        console.error('Error creating disease:', error)
        alert(`Erro ao criar doença: ${error.message}`)
      } else {
        if (data) setDiseases(prev => [...prev, data[0]].sort((a, b) => a.cid_code.localeCompare(b.cid_code)))
        setIsModalOpen(false)
      }
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    if (window.confirm('Tem certeza que deseja excluir esta doença?')) {
      const { error } = await supabase.from('diseases').delete().eq('id', id)
      if (error) {
        console.error('Error deleting disease:', error)
        alert('Erro ao excluir doença.')
      } else {
        setDiseases(prev => prev.filter(d => d.id !== id))
      }
    }
  }

  const filteredDiseases = diseases.filter(d => {
    const term = removeAccents(searchTerm).toLowerCase()
    return removeAccents(d.cid_code.toLowerCase()).includes(term) ||
           removeAccents(d.description.toLowerCase()).includes(term)
  })

  if (!mounted) return null

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <ModuleHeader 
          icon={Stethoscope}
          title="Doenças (CID)" 
          description="Gerencie o cadastro de doenças e CIDs."
        />
        <button 
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          Nova Doença
        </button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por CID ou descrição..." 
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-sm text-slate-500">
                <th className="p-4 font-medium">CID</th>
                <th className="p-4 font-medium">Descrição</th>
                <th className="p-4 font-medium">CIDs Acessórios</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDiseases.map((disease) => (
                <tr key={disease.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-medium text-slate-900">{disease.cid_code}</td>
                  <td className="p-4 text-slate-600">{disease.description}</td>
                  <td className="p-4 text-slate-600">{disease.accessory_cids?.join(', ') || '-'}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenModal(disease)} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 size={18} /></button>
                      <button onClick={(e) => handleDelete(e, disease.id)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingDisease ? 'Editar Doença' : 'Nova Doença'}
          className="max-w-xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">CID</label>
              <input required type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.cid_code || ''} onChange={e => setFormData({ ...formData, cid_code: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Descrição</label>
              <input required type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">CIDs Acessórios (separados por vírgula)</label>
              <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.accessory_cids?.join(', ') || ''} onChange={e => setFormData({ ...formData, accessory_cids: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600">Cancelar</button>
              <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium">Salvar</button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  )
}

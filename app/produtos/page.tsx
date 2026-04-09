'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit2,
  AlertTriangle,
  Briefcase,
  Stethoscope
} from 'lucide-react'
import { DiseaseSelector } from '@/components/diseases/DiseaseSelector'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { formatDate, removeAccents } from '@/lib/utils'

interface LawArea {
  id: number
  name: string
}

interface Disease {
  id: string
  cid_code: string
  description: string
}

interface Product {
  id: number
  name: string
  law_area_id: number | null
  law_areas?: { name: string }
  created_at: string
}

export default function ProdutosPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [lawAreas, setLawAreas] = useState<LawArea[]>([])
  const [selectedDiseases, setSelectedDiseases] = useState<Disease[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [mounted, setMounted] = useState(false)

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    law_area_id: null
  })

  const [areaName, setAreaName] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setMounted(true)
        return
      }

      const [productsRes, areasRes] = await Promise.all([
        supabase.from('products').select('*, law_areas(name)').order('name'),
        supabase.from('law_areas').select('*').order('name')
      ])
      
      if (productsRes.error) console.error('Error fetching products:', productsRes.error)
      else setProducts(productsRes.data || [])

      if (areasRes.error) console.error('Error fetching law areas:', areasRes.error)
      else setLawAreas(areasRes.data || [])

      setMounted(true)
    }

    fetchData()
  }, [])

  const handleOpenModal = async (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setFormData(product)
      
      // Fetch associated diseases
      const { data } = await supabase
        .from('product_diseases')
        .select('disease_id, diseases(*)')
        .eq('product_id', product.id)
      
      setSelectedDiseases(data?.map(d => d.diseases) || [])
    } else {
      setEditingProduct(null)
      setFormData({
        name: '',
        law_area_id: lawAreas.length > 0 ? lawAreas[0].id : null
      })
      setSelectedDiseases([])
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isSupabaseConfigured) {
      alert('Supabase não configurado. Não é possível salvar.')
      return
    }

    const productData = {
      name: formData.name,
      law_area_id: formData.law_area_id,
      updated_by: user?.id || null
    }

    if (editingProduct) {
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id)
        .select('*, law_areas(name)')
      
      if (error) {
        console.error('Error updating product:', error)
        alert('Erro ao atualizar produto.')
      } else {
        // Update diseases
        await supabase.from('product_diseases').delete().eq('product_id', editingProduct.id)
        if (selectedDiseases.length > 0) {
          await supabase.from('product_diseases').insert(selectedDiseases.map(d => ({ product_id: editingProduct.id, disease_id: d.id })))
        }
        
        if (data) {
          setProducts(prev => prev.map(p => p.id === editingProduct.id ? data[0] : p))
        }
        setIsModalOpen(false)
      }
    } else {
      (productData as any).created_by = user?.id || null
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select('*, law_areas(name)')
      
      if (error) {
        console.error('Error creating product:', error)
        alert(`Erro ao criar produto: ${error.message || error.details || JSON.stringify(error)}`)
      } else {
        // Save diseases
        if (data && selectedDiseases.length > 0) {
          await supabase.from('product_diseases').insert(selectedDiseases.map(d => ({ product_id: data[0].id, disease_id: d.id })))
        }
        
        if (data) {
          setProducts(prev => [...prev, data[0]])
        }
        setIsModalOpen(false)
      }
    }
  }

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured) return

    const { data, error } = await supabase
      .from('law_areas')
      .insert([{ name: areaName, created_by: user?.id || null, updated_by: user?.id || null }])
      .select()
    
    if (error) {
      console.error('Error creating law area:', error)
      alert(`Erro ao criar área do direito: ${error.message || error.details || JSON.stringify(error)}`)
    } else {
      if (data) {
        setLawAreas(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)))
        setFormData(prev => ({ ...prev, law_area_id: data[0].id }))
      }
      setIsAreaModalOpen(false)
      setAreaName('')
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error('Error deleting product:', error)
        alert('Erro ao excluir produto.')
      } else {
        setProducts(prev => prev.filter(p => p.id !== id))
      }
    }
  }

  const filteredProducts = products.filter(p => {
    const term = removeAccents(searchTerm).toLowerCase()
    return removeAccents(p.name?.toLowerCase() || '').includes(term) ||
           removeAccents(p.law_areas?.name?.toLowerCase() || '').includes(term)
  })

  if (!mounted) return null

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <ModuleHeader 
          icon={Briefcase}
          title="Produtos" 
          description="Gerencie os tipos de ações e requerimentos."
        />
        <div className="flex gap-2">
          <button 
            onClick={() => window.location.href = '/doencas'}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Stethoscope size={20} />
            Nova Doença
          </button>
          <button 
            onClick={() => setIsAreaModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Nova Área
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Novo Produto
          </button>
        </div>

        {!isSupabaseConfigured && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800">
            <AlertTriangle className="text-amber-500 shrink-0" size={20} />
            <p className="text-sm">
              <strong>Supabase não configurado:</strong> Configure as variáveis de ambiente no painel do AI Studio para que os dados sejam salvos.
            </p>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou área..." 
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-sm text-slate-500">
                  <th className="p-4 font-medium">Produto</th>
                  <th className="p-4 font-medium">Área do Direito</th>
                  <th className="p-4 font-medium">Data de Cadastro</th>
                  <th className="p-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product, index) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={product.id} 
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="p-4">
                      <div className="font-medium text-slate-900">{product.name}</div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                        {product.law_areas?.name || 'Não definida'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-600">
                        {formatDate(product.created_at)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(product)}
                          className="p-2 text-slate-600 md:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 bg-slate-50 md:bg-transparent rounded-lg transition-colors"
                          title="Editar Produto"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, product.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Excluir Produto"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredProducts.length === 0 && (
            <div className="p-12 text-center">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="text-slate-400" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Nenhum produto encontrado</h3>
              <p className="text-slate-500 mt-1">Crie um novo produto ou serviço para começar.</p>
            </div>
          )}
        </div>

        {/* Modal de Produto */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
          className="max-w-xl"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Salário-Maternidade, Divórcio, etc."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Área do Direito</label>
              <select 
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={formData.law_area_id || ''}
                onChange={e => setFormData({ ...formData, law_area_id: Number(e.target.value) })}
              >
                <option value="">Selecione uma área...</option>
                {lawAreas.map(area => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Doenças (CIDs)</label>
              <DiseaseSelector 
                selectedDiseases={selectedDiseases}
                onDiseaseSelect={(d) => setSelectedDiseases(prev => [...prev, d])}
                onDiseaseRemove={(id) => setSelectedDiseases(prev => prev.filter(d => d.id !== id))}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal de Área do Direito */}
        <Modal 
          isOpen={isAreaModalOpen} 
          onClose={() => setIsAreaModalOpen(false)} 
          title="Nova Área do Direito"
          className="max-w-md"
        >
          <form onSubmit={handleCreateArea} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Área</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={areaName}
                onChange={e => setAreaName(e.target.value)}
                placeholder="Ex: Previdenciário, Trabalhista..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setIsAreaModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Cadastrar Área
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  )
}

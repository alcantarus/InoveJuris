'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../../dashboard-layout'
import { 
  Plus, 
  Tag, 
  Trash2, 
  Edit2, 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Search,
  FileText
} from 'lucide-react'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import Link from 'next/link'

interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
}

export default function CategoriasFinanceirasPage() {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense'
  })

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [categoryTotals, setCategoryTotals] = useState<Record<number, number>>({})

  useEffect(() => {
    const fetchCategoriesAndTotals = async () => {
      if (!isSupabaseConfigured) {
        setMounted(true)
        return
      }

      // 1. Fetch Categories
      const { data: categoriesData, error: catError } = await supabase
        .from('financial_categories')
        .select('*')
        .order('name')
      
      if (catError) {
        console.error('Error fetching categories:', catError)
      } else {
        setCategories(categoriesData || [])
      }

      // 2. Fetch Transactions for Totals
      let query = supabase.from('financial_transactions').select('category_id, amount, type')
      
      if (startDate) query = query.gte('date', startDate)
      if (endDate) query = query.lte('date', endDate)
      
      const { data: transactions, error: transError } = await query

      if (!transError && transactions) {
        const totals: Record<number, number> = {}
        transactions.forEach((t: any) => {
          if (t.category_id) {
            totals[t.category_id] = (totals[t.category_id] || 0) + t.amount
          }
        })
        setCategoryTotals(totals)
      }

      setMounted(true)
    }

    fetchCategoriesAndTotals()
  }, [startDate, endDate])

  if (!mounted) return null

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setFormData({
        name: category.name,
        type: category.type
      })
    } else {
      setEditingCategory(null)
      setFormData({
        name: '',
        type: 'expense'
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingCategory) {
      const { error } = await supabase
        .from('financial_categories')
        .update({ ...formData, updated_by: user?.id || null })
        .eq('id', editingCategory.id)
      
      if (error) {
        console.error('Error updating category:', error)
        alert('Erro ao atualizar categoria.')
      } else {
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, ...formData } : c))
        setIsModalOpen(false)
      }
    } else {
      const { data, error } = await supabase
        .from('financial_categories')
        .insert([{ ...formData, created_by: user?.id || null }])
        .select()
      
      if (error) {
        console.error('Error creating category:', error)
        alert(`Erro ao criar categoria: ${error.message}. Verifique se a tabela 'financial_categories' existe no seu Supabase.`)
      } else {
        if (data) setCategories(prev => [...prev, data[0]])
        setIsModalOpen(false)
      }
    }
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      const { error } = await supabase
        .from('financial_categories')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error('Error deleting category:', error)
        alert('Erro ao excluir categoria.')
      } else {
        setCategories(prev => prev.filter(c => c.id !== id))
      }
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/fluxo-caixa" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Categorias Financeiras</h1>
            <p className="text-slate-500 mt-1">Classifique suas receitas e despesas para relatórios precisos.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-500 font-medium">De:</span>
              <input 
                type="date"
                className="bg-transparent text-sm outline-none text-slate-700"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-500 font-medium">Até:</span>
              <input 
                type="date"
                className="bg-transparent text-sm outline-none text-slate-700"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Nova Categoria
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Income Categories */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-emerald-50/30 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <TrendingUp size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Categorias de Receita</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {categories.filter(c => c.type === 'income').map(category => (
                <div key={category.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Tag size={16} className="text-slate-400" />
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-700">{category.name}</span>
                      {(startDate || endDate) && (
                        <span className="text-xs text-emerald-600 font-medium">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(categoryTotals[category.id] || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Link 
                      href={`/fluxo-caixa/movimentacoes?categoryId=${category.id}&startDate=${startDate}&endDate=${endDate}`}
                      className="p-2 text-slate-600 md:text-slate-400 hover:text-emerald-600 bg-slate-50 md:bg-transparent rounded-lg"
                      title="Ver Extrato"
                    >
                      <FileText size={16} />
                    </Link>
                    <button onClick={() => handleOpenModal(category)} className="p-2 text-slate-600 md:text-slate-400 hover:text-indigo-600 bg-slate-50 md:bg-transparent rounded-lg"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(category.id)} className="p-2 text-slate-600 md:text-slate-400 hover:text-rose-600 bg-slate-50 md:bg-transparent rounded-lg"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              {categories.filter(c => c.type === 'income').length === 0 && (
                <div className="p-8 text-center text-slate-400 italic text-sm">Nenhuma categoria de receita.</div>
              )}
            </div>
          </div>

          {/* Expense Categories */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-rose-50/30 flex items-center gap-3">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                <TrendingDown size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Categorias de Despesa</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {categories.filter(c => c.type === 'expense').map(category => (
                <div key={category.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Tag size={16} className="text-slate-400" />
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-700">{category.name}</span>
                      {(startDate || endDate) && (
                        <span className="text-xs text-rose-600 font-medium">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(categoryTotals[category.id] || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Link 
                      href={`/fluxo-caixa/movimentacoes?categoryId=${category.id}&startDate=${startDate}&endDate=${endDate}`}
                      className="p-2 text-slate-600 md:text-slate-400 hover:text-emerald-600 bg-slate-50 md:bg-transparent rounded-lg"
                      title="Ver Extrato"
                    >
                      <FileText size={16} />
                    </Link>
                    <button onClick={() => handleOpenModal(category)} className="p-2 text-slate-600 md:text-slate-400 hover:text-indigo-600 bg-slate-50 md:bg-transparent rounded-lg"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(category.id)} className="p-2 text-slate-600 md:text-slate-400 hover:text-rose-600 bg-slate-50 md:bg-transparent rounded-lg"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              {categories.filter(c => c.type === 'expense').length === 0 && (
                <div className="p-8 text-center text-slate-400 italic text-sm">Nenhuma categoria de despesa.</div>
              )}
            </div>
          </div>
        </div>

        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Categoria</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Aluguel, Honorários, Marketing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'income' })}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all",
                    formData.type === 'income' 
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                      : "border-slate-100 text-slate-500 hover:border-slate-200"
                  )}
                >
                  <TrendingUp size={18} />
                  Receita
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'expense' })}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all",
                    formData.type === 'expense' 
                      ? "border-rose-500 bg-rose-50 text-rose-700" 
                      : "border-slate-100 text-slate-500 hover:border-slate-200"
                  )}
                >
                  <TrendingDown size={18} />
                  Despesa
                </button>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-md"
              >
                {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}

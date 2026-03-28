'use client'

import React, { useState, useEffect } from 'react'
import { 
  Scale, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  User as UserIcon,
  Shield,
  CheckCircle2,
  XCircle,
  Palette
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import DashboardLayout from '../dashboard-layout'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ModuleHeader } from '@/components/ModuleHeader'

interface Lawyer {
  id: number
  user_id?: number
  name?: string
  oab_number: string
  specialty: string
  color_code: string
  is_partner: boolean
  created_at: string
  users?: {
    name: string
    email: string
  }
}

interface User {
  id: number
  name: string
  email: string
}

export default function LawyersPage() {
  const { user: currentUser } = useAuth()
  const [lawyers, setLawyers] = useState<Lawyer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLawyer, setEditingLawyer] = useState<Lawyer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [formData, setFormData] = useState({
    user_id: undefined as number | undefined,
    name: '',
    is_manual: false,
    oab_number: '',
    specialty: '',
    color_code: '#4F46E5',
    is_partner: false
  })

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    if (!isSupabaseConfigured) {
      setMounted(true)
      return
    }
    setLoading(true)
    try {
      // Fetch lawyers with user info
      const { data: lawyersData, error: lawyersError } = await supabase
        .from('lawyers')
        .select(`
          *,
          users:user_id (name, email)
        `)
        .order('created_at', { ascending: false })

      if (lawyersError) throw lawyersError
      setLawyers(lawyersData || [])

      // Fetch users who are not yet lawyers (optional, but helpful)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .order('name')

      if (usersError) throw usersError
      setUsers(usersData || [])
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
      setMounted(true)
    }
  }

  const handleOpenModal = (lawyer?: Lawyer) => {
    if (lawyer) {
      setEditingLawyer(lawyer)
      setFormData({
        user_id: lawyer.user_id,
        name: lawyer.name || '',
        is_manual: !lawyer.user_id,
        oab_number: lawyer.oab_number || '',
        specialty: lawyer.specialty || '',
        color_code: lawyer.color_code || '#4F46E5',
        is_partner: lawyer.is_partner
      })
    } else {
      setEditingLawyer(null)
      setFormData({
        user_id: undefined,
        name: '',
        is_manual: false,
        oab_number: '',
        specialty: '',
        color_code: '#4F46E5',
        is_partner: false
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.is_manual && !formData.user_id) {
      toast.error('Selecione um usuário ou opte pelo cadastro manual')
      return
    }

    if (formData.is_manual && !formData.name.trim()) {
      toast.error('Digite o nome do advogado')
      return
    }

    try {
      const payload = {
        user_id: formData.is_manual ? null : formData.user_id,
        name: formData.is_manual ? formData.name : null,
        oab_number: formData.oab_number,
        specialty: formData.specialty,
        color_code: formData.color_code,
        is_partner: formData.is_partner,
        updated_at: new Date().toISOString()
      }

      if (editingLawyer) {
        // Check if OAB is already in use by another lawyer
        if (formData.oab_number) {
          const isOabInUse = lawyers.some(l => l.oab_number === formData.oab_number && l.id !== editingLawyer.id)
          if (isOabInUse) {
            toast.error('Este número de OAB já está cadastrado para outro advogado.')
            return
          }
        }

        const { error } = await supabase
          .from('lawyers')
          .update(payload)
          .eq('id', editingLawyer.id)

        if (error) throw error
        toast.success('Advogado atualizado com sucesso')
      } else {
        // Check if user is already a lawyer
        if (!formData.is_manual) {
          const isAlreadyLawyer = lawyers.some(l => l.user_id === formData.user_id)
          if (isAlreadyLawyer) {
            toast.error('Este usuário já está cadastrado como advogado')
            return
          }
        }
        
        // Check if OAB is already in use
        if (formData.oab_number) {
          const isOabInUse = lawyers.some(l => l.oab_number === formData.oab_number)
          if (isOabInUse) {
            toast.error('Este número de OAB já está cadastrado para outro advogado.')
            return
          }
        }

        const { error } = await supabase
          .from('lawyers')
          .insert([payload])

        if (error) throw error
        toast.success('Advogado cadastrado com sucesso')
      }
      
      setIsModalOpen(false)
      fetchData()
    } catch (error: any) {
      console.error('Error saving lawyer:', error)
      if (error.message?.includes('lawyers_oab_number_key')) {
        toast.error('Este número de OAB já está cadastrado para outro advogado.')
      } else {
        toast.error(error.message || 'Erro ao salvar advogado')
      }
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este advogado?')) return

    try {
      const { error } = await supabase
        .from('lawyers')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Advogado excluído com sucesso')
      fetchData()
    } catch (error: any) {
      console.error('Error deleting lawyer:', error)
      toast.error('Erro ao excluir advogado')
    }
  }

  const filteredLawyers = lawyers.filter(l => 
    (l.users?.name || l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.oab_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!mounted) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <ModuleHeader 
            title="Gestão de Advogados" 
            description="Gerencie o corpo jurídico do escritório"
            icon={Scale}
          />
          <button 
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm font-semibold"
          >
            <Plus size={20} />
            Novo Advogado
          </button>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome, OAB ou especialidade..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-medium">
            <Filter size={18} />
            Filtros
          </button>
        </div>

        {/* Lawyers Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredLawyers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLawyers.map((lawyer) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={lawyer.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group"
              >
                <div className="h-2 w-full" style={{ backgroundColor: lawyer.color_code }} />
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <UserIcon size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 leading-tight">{lawyer.users?.name || lawyer.name}</h3>
                        <p className="text-xs text-slate-500">{lawyer.users?.email || 'Sem usuário vinculado'}</p>
                      </div>
                    </div>
                    <div className="relative group/menu">
                      <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all">
                        <MoreVertical size={18} />
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-10 hidden group-hover/menu:block">
                        <button 
                          onClick={() => handleOpenModal(lawyer)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
                        >
                          <Edit2 size={14} /> Editar
                        </button>
                        <button 
                          onClick={() => handleDelete(lawyer.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">OAB</span>
                      <span className="font-medium text-slate-700">{lawyer.oab_number || 'Não informado'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Especialidade</span>
                      <span className="font-medium text-slate-700">{lawyer.specialty || 'Geral'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Tipo</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        lawyer.is_partner ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                      )}>
                        {lawyer.is_partner ? 'Sócio' : 'Associado'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Shield size={12} />
                      <span>Acesso Ativo</span>
                    </div>
                    <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: lawyer.color_code }} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Scale size={32} />
            </div>
            <h3 className="text-lg font-medium text-slate-800">Nenhum advogado encontrado</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-1">
              Comece cadastrando os profissionais do seu escritório para gerenciar seus processos.
            </p>
            <button 
              onClick={() => handleOpenModal()}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
            >
              <Plus size={18} />
              Cadastrar Primeiro Advogado
            </button>
          </div>
        )}

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800">
                    {editingLawyer ? 'Editar Advogado' : 'Novo Advogado'}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg">
                    <XCircle size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {!editingLawyer && (
                    <div className="flex items-center gap-4 mb-2">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, is_manual: false})}
                        className={cn(
                          "flex-1 py-2 text-xs font-bold rounded-lg border transition-all",
                          !formData.is_manual 
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        Vincular Usuário
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, is_manual: true})}
                        className={cn(
                          "flex-1 py-2 text-xs font-bold rounded-lg border transition-all",
                          formData.is_manual 
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        Cadastro Manual
                      </button>
                    </div>
                  )}

                  {!editingLawyer && !formData.is_manual && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Usuário Vinculado</label>
                      <select 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.user_id || ''}
                        onChange={(e) => setFormData({...formData, user_id: e.target.value ? Number(e.target.value) : undefined})}
                        required
                      >
                        <option value="">Selecione um usuário...</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-slate-500 italic">
                        O advogado deve ter um usuário cadastrado para acessar o sistema.
                      </p>
                    </div>
                  )}

                  {formData.is_manual && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Advogado</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                        placeholder="Digite o nome completo..."
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        required
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Número OAB</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                        placeholder="Ex: 12345/BA"
                        value={formData.oab_number}
                        onChange={(e) => setFormData({...formData, oab_number: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Especialidade</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                        placeholder="Ex: Cível, Penal..."
                        value={formData.specialty}
                        onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                      <Palette size={14} /> Cor de Identificação
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        className="w-12 h-10 p-0.5 bg-white border border-slate-200 rounded-lg cursor-pointer"
                        value={formData.color_code}
                        onChange={(e) => setFormData({...formData, color_code: e.target.value})}
                      />
                      <input 
                        type="text" 
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm"
                        value={formData.color_code}
                        onChange={(e) => setFormData({...formData, color_code: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500"
                        checked={formData.is_partner}
                        onChange={(e) => setFormData({...formData, is_partner: e.target.checked})}
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-800">Sócio do Escritório</span>
                        <span className="text-xs text-slate-500">Define privilégios em relatórios financeiros</span>
                      </div>
                    </label>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-4 py-2 text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all font-medium"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-sm"
                    >
                      {editingLawyer ? 'Salvar Alterações' : 'Cadastrar Advogado'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}

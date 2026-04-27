'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { 
  Search, 
  Plus, 
  AlertTriangle,
  Shield,
} from 'lucide-react'
import { Modal } from '@/components/Modal'
import { toast } from 'sonner'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { User, useAuth } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import { removeAccents } from '@/lib/utils'
import bcrypt from 'bcryptjs'
import { UserTable } from '@/components/UserTable'

export default function UsuariosPage() {
  const { user: currentUser, impersonate } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<{id: number, name: string, permissions: string[]}[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)

  const handleImpersonate = async (userToImpersonate: User) => {
    if (window.confirm(`Tem certeza que deseja acessar o sistema como ${userToImpersonate.name}? Esta ação será registrada na auditoria.`)) {
      const result = await impersonate(userToImpersonate.id, getAppEnv());
      if (result.success) {
        toast.success(`Acessando como ${userToImpersonate.name}`);
      } else {
        toast.error(result.error || 'Erro ao acessar como usuário.');
      }
    }
  }

  const [formData, setFormData] = useState<Partial<User> & { password?: string, neverExpires?: boolean, role_id?: number }>({
    name: '',
    email: '',
    password: '',
    role_id: undefined,
    canAccessDashboard: true,
    canAccessClients: false,
    canAccessProcesses: false,
    canAccessContracts: false,
    canAccessCashFlow: false,
    is_superadmin: false,
    canAccessReceivables: false,
    canAccessProducts: false,
    canAccessIndicators: false,
    canAccessReports: false,
    canAccessUsers: false,
    canAccessDocuments: false,
    canAccessDocTemplates: false,
    canAccessDocGeneration: false,
    canAccessLeads: false,
    canAccessSettings: false,
    canAccessAudit: false,
    canAccessLawyers: false,
    canAccessProdEnv: true,
    canAccessTestEnv: false,
    expiration_date: '',
    neverExpires: true
  })

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setMounted(true)
        return
      }

      // Fetch Roles with their permissions
      const { data: rolesData } = await supabase
        .from('roles')
        .select(`
          id, 
          name,
          role_permissions (
            permissions (slug)
          )
        `)
        .order('name')
      
      const formattedRoles = (rolesData || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        permissions: r.role_permissions?.map((rp: any) => rp.permissions?.slug) || []
      }))
      
      setRoles(formattedRoles)

      const { data, error } = await supabase
        .from('users')
        .select(`
          id, name, email, is_superadmin,
          "canAccessDashboard", "canAccessClients", "canAccessProcesses", 
          "canAccessContracts", "canAccessReceivables", "canAccessCashFlow", "canAccessProducts", 
          "canAccessIndicators", "canAccessReports", "canAccessUsers", 
          "canAccessSettings", "canAccessAudit", "canAccessLawyers", "canAccessProdEnv", 
          "canAccessTestEnv", "canAccessDocuments", "canAccessDocTemplates", "canAccessDocGeneration", expiration_date, created_at,
          user_roles!user_id (
            role_id,
            roles (name)
          )
        `)
        .order('name')
      
      if (error) {
        console.error('Error fetching users:', error)
        toast.error('Erro ao carregar usuários')
      } else {
        const formattedUsers = (data || []).map((u: any) => ({
          ...u,
          role_id: u.user_roles?.[0]?.role_id,
          role_name: u.user_roles?.[0]?.roles?.name
        }))
        setUsers(formattedUsers)
      }

      setMounted(true)
    }

    fetchData()
  }, [currentUser])

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setFormData({ 
        ...user, 
        password: '', 
        expiration_date: user.expiration_date || '',
        neverExpires: !user.expiration_date,
        canAccessAudit: user.canAccessAudit || false,
        canAccessLawyers: user.canAccessLawyers || false,
        canAccessProdEnv: user.canAccessProdEnv !== false,
        canAccessTestEnv: user.canAccessTestEnv || false,
        canAccessContracts: user.canAccessContracts || false,
        canAccessCashFlow: user.canAccessCashFlow || false,
        canAccessReceivables: user.canAccessReceivables || false,
        canAccessDocTemplates: user.canAccessDocTemplates || false,
        canAccessDocGeneration: user.canAccessDocGeneration || false,
        is_superadmin: user.is_superadmin || false,
        role_id: (user as any).role_id
      })
    } else {
      setEditingUser(null)
      setFormData({
        name: '',
        email: '',
        password: '',
        role_id: undefined,
        canAccessDashboard: true,
        canAccessClients: false,
        canAccessProcesses: false,
        canAccessContracts: false,
        canAccessReceivables: false,
        canAccessCashFlow: false,
        canAccessProducts: false,
        canAccessIndicators: false,
        canAccessReports: false,
        canAccessUsers: false,
        canAccessDocuments: false,
        canAccessDocTemplates: false,
        canAccessDocGeneration: false,
        canAccessSettings: false,
        canAccessAudit: false,
        canAccessProdEnv: true,
        canAccessTestEnv: false,
        expiration_date: '',
        neverExpires: true
      })
    }
    setIsModalOpen(true)
  }

  const handleRoleChange = (roleId: number) => {
    const selectedRole = roles.find(r => r.id === roleId)
    if (!selectedRole) return

    const newPermissions = { ...formData, role_id: roleId }
    const perms = selectedRole.permissions || []
    const isAdmin = selectedRole.name === 'Administrador'

    const has = (slug: string) => isAdmin || perms.includes(slug)

    newPermissions.canAccessDashboard = has('access_dashboard')
    newPermissions.canAccessClients = has('access_clients')
    newPermissions.canAccessProcesses = has('access_processes')
    newPermissions.canAccessContracts = has('access_finance')
    newPermissions.canAccessCashFlow = has('access_cashflow')
    newPermissions.canAccessReceivables = has('access_receivables')
    newPermissions.canAccessProducts = has('access_products')
    newPermissions.canAccessIndicators = has('access_indicators')
    newPermissions.canAccessReports = has('access_reports')
    newPermissions.canAccessUsers = has('access_users')
    newPermissions.canAccessSettings = has('access_settings')
    newPermissions.canAccessAudit = has('access_audit')
    newPermissions.canAccessLawyers = has('access_lawyers')
    newPermissions.canAccessDocuments = has('access_documents')
    newPermissions.canAccessDocTemplates = has('access_doc_templates')
    newPermissions.canAccessDocGeneration = has('access_doc_generation')
    newPermissions.canAccessLeads = has('access_leads')
    newPermissions.canAccessProdEnv = has('access_prod_env')
    newPermissions.canAccessTestEnv = has('access_test_env')

    setFormData(newPermissions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isSupabaseConfigured) {
      toast.error('Supabase não configurado. Não é possível salvar.')
      return
    }

    const currentEnv = getAppEnv()

    const userData: any = {
      name: formData.name,
      email: formData.email,
      canAccessDashboard: formData.canAccessDashboard,
      canAccessClients: formData.canAccessClients,
      canAccessProcesses: formData.canAccessProcesses,
      canAccessContracts: formData.canAccessContracts,
      canAccessCashFlow: formData.canAccessCashFlow,
      canAccessReceivables: formData.canAccessReceivables,
      canAccessProducts: formData.canAccessProducts,
      canAccessIndicators: formData.canAccessIndicators,
      canAccessReports: formData.canAccessReports,
      canAccessUsers: formData.canAccessUsers,
      canAccessSettings: formData.canAccessSettings,
      canAccessAudit: formData.canAccessAudit,
      canAccessLawyers: formData.canAccessLawyers,
      canAccessDocuments: formData.canAccessDocuments,
      canAccessDocTemplates: formData.canAccessDocTemplates,
      canAccessDocGeneration: formData.canAccessDocGeneration,
      canAccessLeads: formData.canAccessLeads,
      canAccessProdEnv: currentEnv === 'test' ? false : formData.canAccessProdEnv,
      canAccessTestEnv: formData.canAccessTestEnv,
      is_superadmin: formData.is_superadmin,
      expiration_date: formData.neverExpires ? null : (formData.expiration_date || null),
    }

    if (formData.password) {
      const salt = bcrypt.genSaltSync(10)
      userData.password = bcrypt.hashSync(formData.password, salt)
    }

    if (editingUser) {
      userData.updated_by = currentUser?.id
      const { data, error } = await supabase
        .from('users')
        .update(userData)
        .eq('id', editingUser.id)
        .select(`
          id, name, email, is_superadmin,
          "canAccessDashboard", "canAccessClients", "canAccessProcesses", 
          "canAccessContracts", "canAccessReceivables", "canAccessCashFlow", "canAccessProducts", 
          "canAccessIndicators", "canAccessReports", "canAccessUsers", 
          "canAccessSettings", "canAccessAudit", "canAccessLawyers", "canAccessProdEnv", 
          "canAccessTestEnv", "canAccessDocuments", "canAccessDocTemplates", "canAccessDocGeneration", expiration_date, created_at,
          user_roles!user_id (
            role_id,
            roles (name)
          )
        `)
      
      if (error) {
        console.error('Error updating user:', error)
        toast.error(`Erro ao atualizar usuário: ${error.message || 'Erro desconhecido'}`)
      } else {
        // Update user_roles
        if (formData.role_id) {
          await supabase.from('user_roles').delete().eq('user_id', editingUser.id)
          await supabase.from('user_roles').insert({ user_id: editingUser.id, role_id: formData.role_id })
        }

        if (data && data.length > 0) {
          const formatted = {
            ...data[0],
            role_id: formData.role_id,
            role_name: roles.find(r => r.id === formData.role_id)?.name
          }
          setUsers(prev => prev.map(u => u.id === editingUser.id ? formatted : u))
          toast.success('Usuário atualizado com sucesso!')
        }
        setIsModalOpen(false)
      }
    } else {
      if (!formData.password) {
        toast.error('A senha é obrigatória para novos usuários.')
        return
      }

      userData.created_by = currentUser?.id || null
      userData.updated_by = currentUser?.id || null
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select(`
          id, name, email, 
          "canAccessDashboard", "canAccessClients", "canAccessProcesses", 
          "canAccessContracts", "canAccessReceivables", "canAccessCashFlow", "canAccessProducts", 
          "canAccessIndicators", "canAccessReports", "canAccessUsers", 
          "canAccessSettings", "canAccessAudit", "canAccessLawyers", "canAccessProdEnv", 
          "canAccessTestEnv", "canAccessDocuments", "canAccessDocTemplates", "canAccessDocGeneration", expiration_date, created_at,
          user_roles!user_id (
            role_id,
            roles (name)
          )
        `)
      
      if (error) {
        console.error('Error creating user:', error)
        toast.error(`Erro ao criar usuário: ${error.message || 'Erro desconhecido'}`)
      } else {
        // Insert user_roles
        if (data && data.length > 0 && formData.role_id) {
          await supabase.from('user_roles').insert({ user_id: data[0].id, role_id: formData.role_id })
        }

        if (data && data.length > 0) {
          const formatted = {
            ...data[0],
            role_id: formData.role_id,
            role_name: roles.find(r => r.id === formData.role_id)?.name
          }
          setUsers(prev => [...prev, formatted])
          toast.success('Usuário criado com sucesso!')
        }
        setIsModalOpen(false)
      }
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Find the user being deleted
    const userToDelete = users.find(u => u.id === id)
    if (!userToDelete) return

    // Safeguard: Prevent self-deletion or deletion of protected users
    if (userToDelete.id === currentUser?.id) {
      toast.error('Você não pode excluir a si mesmo.')
      return
    }
    if (userToDelete.name === 'Administrador' || userToDelete.name === 'Anderson Alcântara Silva') {
      toast.error('Este usuário não pode ser excluído.')
      return
    }
    if (userToDelete.is_superadmin && !currentUser?.is_superadmin) {
      toast.error('Você não tem permissão para excluir um super administrador.')
      return
    }

    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error('Error deleting user:', error)
        toast.error('Erro ao excluir usuário.')
      } else {
        setUsers(prev => prev.filter(u => u.id !== id))
        toast.success('Usuário excluído com sucesso!')
      }
    }
  }

  const filteredUsers = users.filter(u => {
    const term = removeAccents(searchTerm).toLowerCase()
    return removeAccents(u.name.toLowerCase()).includes(term) ||
           removeAccents(u.email.toLowerCase()).includes(term)
  })

  if (!mounted) return null


  return (
    <DashboardLayout>
      <div className="space-y-8">
        <ModuleHeader 
          icon={Shield}
          title="Usuários" 
          description="Gerencie os acessos e permissões do sistema."
        />
        <button 
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          Novo Usuário
        </button>

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
            placeholder="Buscar por nome ou e-mail..." 
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <UserTable 
            users={filteredUsers}
            onEdit={handleOpenModal}
            onDelete={handleDelete}
            onImpersonate={currentUser?.role_name === 'Administrador' || currentUser?.email === 'admin@admin.com' ? handleImpersonate : undefined}
          />
          {filteredUsers.length === 0 && (
            <div className="p-12 text-center">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="text-slate-400" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Nenhum usuário encontrado</h3>
              <p className="text-slate-500 mt-1">Crie um novo usuário para começar.</p>
            </div>
          )}
        </div>

        {/* Modal de Usuário */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
          className="max-w-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Perfil de Acesso (RBAC)</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                  value={formData.role_id || ''}
                  onChange={e => handleRoleChange(Number(e.target.value))}
                >
                  <option value="">Selecione um perfil...</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 italic">Ao selecionar um perfil, os módulos abaixo serão configurados automaticamente.</p>
              </div>
              {currentUser?.is_superadmin && (
                <div className="md:col-span-2 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500" 
                      checked={formData.is_superadmin} 
                      onChange={e => setFormData({...formData, is_superadmin: e.target.checked})} 
                    />
                    <span className="text-sm font-bold text-amber-900">Conceder privilégios de Super Administrador</span>
                  </label>
                  <p className="text-xs text-amber-700 mt-1 ml-8">Super Administradores têm acesso total ao sistema e podem modificar outros usuários.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail (Login)</label>
                <input 
                  required
                  type="email" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Senha {editingUser && <span className="text-slate-400 font-normal">(Deixe em branco para manter a atual)</span>}
                </label>
                <input 
                  type="password" 
                  required={!editingUser}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={formData.password || ''}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Data de Expiração de Acesso</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded" 
                      checked={formData.neverExpires} 
                      onChange={e => setFormData({...formData, neverExpires: e.target.checked})} 
                    />
                    <span className="text-xs font-medium text-slate-500">Nunca expira</span>
                  </label>
                </div>
                <input 
                  type="date" 
                  disabled={formData.neverExpires}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  value={formData.expiration_date || ''}
                  onChange={e => setFormData({ ...formData, expiration_date: e.target.value })}
                />
                {!formData.neverExpires && (
                  <p className="text-xs text-slate-400 mt-1">Após esta data, o usuário não conseguirá mais fazer login.</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3 border-b pb-2">Permissões de Acesso</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessDashboard} onChange={e => setFormData({...formData, canAccessDashboard: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Painel (Tela Inicial)</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessClients} onChange={e => setFormData({...formData, canAccessClients: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Clientes</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessProcesses} onChange={e => setFormData({...formData, canAccessProcesses: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Processos</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessContracts} onChange={e => setFormData({...formData, canAccessContracts: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Contratos</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessCashFlow} onChange={e => setFormData({...formData, canAccessCashFlow: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Fluxo de Caixa</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessReceivables} onChange={e => setFormData({...formData, canAccessReceivables: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Contas a Receber</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessProducts} onChange={e => setFormData({...formData, canAccessProducts: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Produtos</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessIndicators} onChange={e => setFormData({...formData, canAccessIndicators: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Indicadores</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessReports} onChange={e => setFormData({...formData, canAccessReports: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Relatórios</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessUsers} onChange={e => setFormData({...formData, canAccessUsers: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Usuários</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessSettings} onChange={e => setFormData({...formData, canAccessSettings: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Configurações</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessAudit} onChange={e => setFormData({...formData, canAccessAudit: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Auditoria</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessLawyers} onChange={e => setFormData({...formData, canAccessLawyers: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Advogados</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessDocuments} onChange={e => setFormData({...formData, canAccessDocuments: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Módulo Documentos</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessDocTemplates} onChange={e => setFormData({...formData, canAccessDocTemplates: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Gestão de Modelos</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessDocGeneration} onChange={e => setFormData({...formData, canAccessDocGeneration: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Geração de Documentos</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.canAccessLeads} onChange={e => setFormData({...formData, canAccessLeads: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Gestão de Leads</span>
                </label>
                <label className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 border-emerald-200 bg-emerald-50/30 ${getAppEnv() === 'test' ? 'opacity-60 grayscale' : ''}`}>
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-emerald-600 rounded" 
                    checked={formData.canAccessProdEnv} 
                    disabled={getAppEnv() === 'test'}
                    onChange={e => setFormData({...formData, canAccessProdEnv: e.target.checked})} 
                  />
                  <div>
                    <span className="text-sm font-medium text-emerald-900 font-bold block">Acesso ao Ambiente de Produção</span>
                    {getAppEnv() === 'test' && (
                      <span className="text-[10px] text-emerald-700 font-normal">Somente editável via Ambiente de Produção</span>
                    )}
                  </div>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 border-amber-200 bg-amber-50/30">
                  <input type="checkbox" className="w-4 h-4 text-amber-600 rounded" checked={formData.canAccessTestEnv} onChange={e => setFormData({...formData, canAccessTestEnv: e.target.checked})} />
                  <span className="text-sm font-medium text-amber-900 font-bold">Acesso ao Ambiente de Testes</span>
                </label>
              </div>
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
                {editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { SlideOver } from '@/app/components/SlideOver'
import { ClientStatsWidget } from '@/components/tasks/ClientStatsWidget'
import { ProcessPopover } from '@/components/clients/ProcessPopover'
import { BirthdayCardGenerator } from '@/components/BirthdayCardGenerator'
import { Modal } from '@/components/Modal'
import { 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  Loader2, 
  AlertTriangle,
  Edit2,
  Trash2,
  Users,
  Gift,
  Filter,
  Download,
  MoreVertical,
  CheckCircle2,
  XCircle,
  MapPin,
  Tag
} from 'lucide-react'
import { motion } from 'motion/react'
import { validateCPF, validateCNPJ, validatePIS, formatCPF, formatCNPJ, formatCEP, formatPhone, removeAccents, cn, formatPIS } from '@/lib/utils'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'

interface Client {
  id: number
  name: string
  email: string
  phone: string
  address: string
  addressNumber: string
  addressComplement: string
  neighborhood: string
  city: string
  uf: string
  cep: string
  status: string
  type: string
  document: string | null
  inssPassword?: string
  civilStatus?: string
  profession?: string
  birthDate?: string | null
  pisNisNit?: string | null
  contractSigned: boolean
  proxySigned: boolean
  isMinor: boolean
  legalRepresentative?: string
  tags: string[]
  last_contact_at?: string | null
  next_follow_up_at?: string | null
  vw_client_process_summary?: {
    active_processes_count: number
    delayed_processes_count: number
  }[]
  health_score?: number
  total_receivable?: number
  total_received?: number
  total_overdue?: number
}

// Debounce hook implementation
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

function ClientCombobox({ value, onChange, placeholder, excludeId }: { value: string | null, onChange: (name: string) => void, placeholder?: string, excludeId?: number }) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [localClients, setLocalClients] = useState<{id: number, name: string, document?: string | null}[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(searchTerm, 300)

  useEffect(() => {
    if (value) {
      setSearchTerm(value)
    } else {
      setSearchTerm('')
    }
  }, [value])

  useEffect(() => {
    const fetchLocalClients = async () => {
      if (!isSupabaseConfigured || !isOpen) return
      
      setIsLoading(true)
      try {
        let query = supabase
          .from('clients')
          .select('id, name, document')
          .eq('organization_id', user?.organizationId)
          .order('name')
          .limit(20)
        
        if (debouncedSearch) {
          query = query.ilike('name', `%${debouncedSearch}%`)
        }
        
        if (excludeId) {
          query = query.neq('id', excludeId)
        }
        
        const { data, error } = await query
        if (error) throw error
        setLocalClients(data || [])
      } catch (error) {
        console.error('Error fetching local clients:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLocalClients()
  }, [debouncedSearch, isOpen, excludeId, user?.organizationId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm(value || '')
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [value])

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none pl-10"
          placeholder={placeholder || "Buscar cliente..."}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        {isLoading ? (
          <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={16} />
        ) : null}
        {searchTerm && (
          <button 
            type="button"
            onClick={() => {
              onChange('')
              setSearchTerm('')
              setIsOpen(true)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <XCircle size={16} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto">
          {localClients.length > 0 ? (
            localClients.map(client => (
              <button
                key={client.id}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col border-b border-slate-50 last:border-0"
                onClick={() => {
                  onChange(client.name)
                  setSearchTerm(client.name)
                  setIsOpen(false)
                }}
              >
                <span className="font-medium text-slate-900">{client.name}</span>
                {client.document && (
                  <span className="text-xs text-slate-500">CPF/CNPJ: {client.document}</span>
                )}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              {isLoading ? 'Buscando...' : 'Nenhum cliente encontrado.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ClientesPageV2() {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [selectedBirthdayClient, setSelectedBirthdayClient] = useState<Client | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
  const [isSearchingCEP, setIsSearchingCEP] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    addressNumber: '',
    addressComplement: '',
    neighborhood: '',
    city: '',
    uf: '',
    cep: '',
    status: 'Ativo',
    type: 'Pessoa Física',
    document: '',
    inssPassword: '',
    civilStatus: 'Solteiro(a)',
    profession: '',
    birthDate: '',
    pisNisNit: '',
    contractSigned: false,
    proxySigned: false,
    isMinor: false,
    legalRepresentative: '',
    tags: [] as string[],
    last_contact_at: '',
    next_follow_up_at: ''
  })
  const [errors, setErrors] = useState<{ document?: string; pis?: string; cep?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // ... (Fetch logic, handleOpenSlideOver, handleSubmit, etc. same as original)
  // I will implement the core functionality here to make it work.

  useEffect(() => {
    const fetchClients = async () => {
      if (!isSupabaseConfigured) {
        setMounted(true)
        return
      }
      setIsLoading(true)
      try {
        // Using the RPC to get summary data
        const { data, error } = await supabase.rpc('get_clients_with_process_summary', { 
          p_from: 0,
          p_to: 1000, // Fetching a larger batch for stats
          p_search_term: ''
        })
        
        if (error) throw error
        
        const formattedClients = (data || []).map((item: any) => ({
          ...item.client_data,
          vw_client_process_summary: [{
            active_processes_count: item.active_processes_count,
            delayed_processes_count: item.delayed_processes_count
          }],
          health_score: item.health_score,
          total_receivable: item.total_receivable,
          total_received: item.total_received,
          total_overdue: item.total_overdue
        }))

        setClients(formattedClients)
      } catch (error: any) {
        console.error('Error fetching clients:', error.message)
      } finally {
        setIsLoading(false)
        setMounted(true)
      }
    }
    fetchClients()
  }, [user?.organizationId])

  if (!mounted) return null

  const handleOpenSlideOver = (client?: Client) => {
    setErrors({})
    if (client) {
      setEditingClient(client)
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        addressNumber: client.addressNumber || '',
        addressComplement: client.addressComplement || '',
        neighborhood: client.neighborhood || '',
        city: client.city || '',
        uf: client.uf || '',
        cep: client.cep || '',
        status: client.status || 'Ativo',
        type: client.type || 'Pessoa Física',
        document: client.document || '',
        inssPassword: client.inssPassword || '',
        civilStatus: client.civilStatus || 'Solteiro(a)',
        profession: client.profession || '',
        birthDate: client.birthDate || '',
        pisNisNit: client.pisNisNit || '',
        contractSigned: !!client.contractSigned,
        proxySigned: !!client.proxySigned,
        isMinor: !!client.isMinor,
        legalRepresentative: client.legalRepresentative || '',
        tags: client.tags || [],
        last_contact_at: client.last_contact_at ? client.last_contact_at.split('T')[0] : '',
        next_follow_up_at: client.next_follow_up_at ? client.next_follow_up_at.split('T')[0] : '',
      })
    } else {
      setEditingClient(null)
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        addressNumber: '',
        addressComplement: '',
        neighborhood: '',
        city: '',
        uf: '',
        cep: '',
        status: 'Ativo',
        type: 'Pessoa Física',
        document: '',
        inssPassword: '',
        civilStatus: 'Solteiro(a)',
        profession: '',
        birthDate: '',
        pisNisNit: '',
        contractSigned: false,
        proxySigned: false,
        isMinor: false,
        legalRepresentative: '',
        tags: [],
        last_contact_at: '',
        next_follow_up_at: ''
      })
    }
    setIsSlideOverOpen(true)
  }

  const handleCEPChange = async (value: string) => {
    const formatted = formatCEP(value)
    setFormData(prev => ({ ...prev, cep: formatted }))
    
    const cleanCEP = formatted.replace(/\D/g, '')
    if (cleanCEP.length === 8) {
      setIsSearchingCEP(true)
      setErrors(prev => ({ ...prev, cep: undefined }))
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)
        const data = await response.json()
        
        if (data.erro) {
          setErrors(prev => ({ ...prev, cep: 'CEP não encontrado.' }))
        } else {
          setFormData(prev => ({
            ...prev,
            address: data.logradouro || prev.address,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            uf: data.uf || prev.uf
          }))
        }
      } catch (error) {
        setErrors(prev => ({ ...prev, cep: 'Erro ao buscar CEP.' }))
      } finally {
        setIsSearchingCEP(false)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    const isCPF = formData.type === 'Pessoa Física'
    const isDocumentValid = isCPF ? validateCPF(formData.document) : validateCNPJ(formData.document)
    
    let newErrors: { document?: string; pis?: string } = {}

    if (!isDocumentValid) {
      newErrors.document = `Documento (${isCPF ? 'CPF' : 'CNPJ'}) inválido.`
    }

    if (formData.type === 'Pessoa Física' && formData.pisNisNit) {
      if (!validatePIS(formData.pisNisNit)) {
        newErrors.pis = 'PIS/NIT/NIS inválido.'
      }
    }

    // Check for duplicate document
    const duplicate = clients.find(c => 
      c.document === formData.document && 
      (!editingClient || c.id !== editingClient.id)
    )

    if (duplicate) {
      newErrors.document = `Este ${isCPF ? 'CPF' : 'CNPJ'} já está cadastrado para o cliente: ${duplicate.name}`
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const clientData = {
      ...formData,
      document: formData.document || null,
      pisNisNit: formData.pisNisNit || null,
      birthDate: formData.birthDate || null,
      tags: formData.tags || [],
      last_contact_at: formData.last_contact_at || null,
      next_follow_up_at: formData.next_follow_up_at || null,
      organization_id: user?.organizationId,
      updated_by: user?.id || null
    }

    if (editingClient) {
      const { error } = await supabase
        .from('clients')
        .update(clientData)
        .eq('id', editingClient.id)
      
      if (error) {
        console.error('Error updating client:', error)
        alert(`Erro ao atualizar cliente: ${error.message || error.details || JSON.stringify(error)}`)
      } else {
        setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...clientData } : c).sort((a, b) => a.name.localeCompare(b.name)))
        setIsSlideOverOpen(false)
      }
    } else {
      const { data, error } = await supabase
        .from('clients')
        .insert([{ ...clientData, created_by: user?.id || null }])
        .select()
      
      if (error) {
        console.error('Error creating client:', error)
        alert(`Erro ao criar cliente: ${error.message || error.details || JSON.stringify(error)}`)
      } else {
        if (data) {
          setClients(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)))
        }
        setIsSlideOverOpen(false)
      }
    }
  }

  const handleDelete = async (id: number) => {
    // 1. Verificar dependências em todas as tabelas relacionadas
    setIsLoading(true)
    try {
      // 1. Verificar dependências na tabela 'contracts'
      const { data, error } = await supabase
        .from('contracts')
        .select('id')
        .eq('client_id', id)
        .eq('organization_id', user?.organizationId)
        .limit(1)
      
      if (error) {
        console.error('Erro ao verificar contratos:', error)
        throw error
      }
      
      if (data && data.length > 0) {
        alert('Não é possível excluir este cliente pois ele possui contratos vinculados.')
        setIsLoading(false)
        return
      }

      // 2. Excluir se não houver dependências
      if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', id)
        
        if (error) {
          console.error('Error deleting client:', error)
          alert('Erro ao excluir cliente.')
        } else {
          setClients(prev => prev.filter(c => c.id !== id))
        }
      }
    } catch (error) {
      console.error('Error checking dependencies or deleting client:', error)
      alert('Erro ao processar exclusão.')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredClients = clients.filter(c => {
    const matchesSearch = removeAccents(c.name.toLowerCase()).includes(removeAccents(searchTerm.toLowerCase())) ||
      (c.document && c.document.includes(searchTerm))
    
    if (!matchesSearch) return false;
    
    if (!selectedFilter || selectedFilter === 'total') return true;
    if (selectedFilter === 'minors') return c.isMinor;
    if (selectedFilter === 'assisted') return !!c.legalRepresentative;
    if (selectedFilter === 'health') return !!(c.name && c.email && c.document);
    return true;
  })

  // Pagination
  const itemsPerPage = 10
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
  const paginatedClients = filteredClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleHeader 
          icon={Users}
          title="Clientes (V2 - Novo Layout)" 
          description="Gerencie sua base de clientes com uma interface otimizada."
        />

        <ClientStatsWidget 
          clients={clients} 
          onFilterChange={setSelectedFilter} 
          selectedFilter={selectedFilter}
        />
        
        <div className="flex justify-between items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou documento..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <button 
            onClick={() => handleOpenSlideOver()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700"
          >
            <Plus size={20} />
            Novo Cliente
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-[35%]">Cliente</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-[15%] text-center">Processos</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-[15%] text-center">Saúde</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-[20%]">Documento</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right w-[15%]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedClients.map(client => (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{client.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        {client.phone && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone size={12} /> {client.phone}
                          </span>
                        )}
                        {client.email && (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail size={12} /> {client.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <ProcessPopover clientId={client.id} clientName={client.name} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        (client.health_score || 0) >= 80 ? "bg-emerald-500" : 
                        (client.health_score || 0) >= 50 ? "bg-amber-500" : "bg-rose-500"
                      )} />
                      <span className="text-xs font-medium text-slate-600">{client.health_score || 0}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{client.document}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => setSelectedBirthdayClient(client)}
                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Gerar Cartão de Aniversário"
                      >
                        <Gift size={18} />
                      </button>
                      <button onClick={() => handleOpenSlideOver(client)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={18}/></button>
                      <button onClick={() => handleDelete(client.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn("px-3 py-1 rounded-lg text-sm", currentPage === page ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <SlideOver 
          isOpen={isSlideOverOpen} 
          onClose={() => setIsSlideOverOpen(false)} 
          title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700">Nome</label>
                <input required className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">E-mail</label>
                <input type="email" className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Telefone</label>
                <input className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Tipo</label>
                <select className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option>Pessoa Física</option>
                  <option>Pessoa Jurídica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Documento</label>
                <input className={cn("w-full px-4 py-2 border rounded-xl", errors.document ? "border-rose-500" : "border-slate-200")} value={formData.document || ''} onChange={e => setFormData({...formData, document: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700">Endereço</label>
                <input className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Número</label>
                <input className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.addressNumber} onChange={e => setFormData({...formData, addressNumber: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Complemento</label>
                <input className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.addressComplement} onChange={e => setFormData({...formData, addressComplement: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Bairro</label>
                <input className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Cidade</label>
                <input className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">UF</label>
                <input className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.uf} onChange={e => setFormData({...formData, uf: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">CEP</label>
                <div className="relative">
                  <input 
                    className={cn("w-full px-4 py-2 border rounded-xl", errors.cep ? "border-rose-500" : "border-slate-200")} 
                    value={formData.cep} 
                    onChange={e => handleCEPChange(e.target.value)} 
                  />
                  {isSearchingCEP && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" size={16} />}
                </div>
                {errors.cep && <p className="text-[10px] text-rose-500 mt-1">{errors.cep}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Status</label>
                <select className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option>Ativo</option>
                  <option>Inativo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Estado Civil</label>
                <select className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.civilStatus} onChange={e => setFormData({...formData, civilStatus: e.target.value})}>
                  <option>Solteiro(a)</option>
                  <option>Casado(a)</option>
                  <option>União Estável</option>
                  <option>Divorciado(a)</option>
                  <option>Viúvo(a)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Profissão</label>
                <input className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.profession} onChange={e => setFormData({...formData, profession: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Data de Nascimento</label>
                <input type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.birthDate || ''} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">PIS/NIS/NIT</label>
                <input className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.pisNisNit || ''} onChange={e => setFormData({...formData, pisNisNit: e.target.value})} />
              </div>
              <div className="col-span-2 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={formData.contractSigned} onChange={e => setFormData({...formData, contractSigned: e.target.checked})} />
                  Contrato Assinado
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={formData.proxySigned} onChange={e => setFormData({...formData, proxySigned: e.target.checked})} />
                  Procuração Assinada
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={formData.isMinor} onChange={e => setFormData({...formData, isMinor: e.target.checked})} />
                  Menor de Idade
                </label>
              </div>
              {formData.isMinor && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Representante Legal</label>
                  <ClientCombobox 
                    placeholder="Buscar representante..."
                    value={formData.legalRepresentative}
                    onChange={(name) => setFormData({ ...formData, legalRepresentative: name })}
                    excludeId={editingClient?.id}
                  />
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
                <div className="flex flex-wrap gap-2 p-2 border border-slate-200 rounded-xl bg-slate-50 min-h-[42px]">
                  {formData.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-xs font-medium">
                      {tag}
                      <button type="button" onClick={() => setFormData({...formData, tags: formData.tags.filter(t => t !== tag)})}>
                        <XCircle size={12} />
                      </button>
                    </span>
                  ))}
                  <input 
                    className="flex-1 bg-transparent border-none outline-none text-xs min-w-[100px]"
                    placeholder="Adicionar tag..."
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const val = e.currentTarget.value.trim()
                        if (val && !formData.tags.includes(val)) {
                          setFormData({...formData, tags: [...formData.tags, val]})
                          e.currentTarget.value = ''
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Último Contato</label>
                <input type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.last_contact_at} onChange={e => setFormData({...formData, last_contact_at: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Próximo Follow-up</label>
                <input type="date" className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.next_follow_up_at} onChange={e => setFormData({...formData, next_follow_up_at: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700">Salvar</button>
          </form>
        </SlideOver>

        {/* Birthday Card Modal */}
        <Modal 
          isOpen={!!selectedBirthdayClient} 
          onClose={() => setSelectedBirthdayClient(null)}
          title="Gerar Cartão de Aniversário"
        >
          {selectedBirthdayClient && (
            <BirthdayCardGenerator 
              clientName={selectedBirthdayClient.name} 
              clientId={selectedBirthdayClient.id.toString()}
              onClose={() => setSelectedBirthdayClient(null)} 
            />
          )}
        </Modal>
      </div>
    </DashboardLayout>
  )
}

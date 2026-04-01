'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { ClientStatsWidget } from '@/components/tasks/ClientStatsWidget'
import { ClientActions } from '@/components/clients/ClientActions'
import { ClientSlideOver } from '@/components/clients/ClientSlideOver'
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Mail, 
  Phone, 
  MapPin, 
  Filter, 
  Download, 
  Trash2, 
  Edit2,
  CheckCircle2,
  XCircle,
  Users,
  User,
  Gift
} from 'lucide-react'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import { BirthdayCardGenerator } from '@/components/BirthdayCardGenerator'
import { validateCPF, validateCNPJ, formatCPF, formatCNPJ, validatePIS, formatPIS, cn, formatCEP, formatPhone, removeAccents } from '@/lib/utils'
import { Loader2, AlertTriangle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import Link from 'next/link'

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
}

const DEFAULT_CLIENTS: Client[] = [
  { 
    id: 1, 
    name: 'João Silva', 
    email: 'joao.silva@email.com', 
    phone: '(11) 98765-4321', 
    address: 'Rua das Flores, 123',
    addressNumber: '123',
    addressComplement: '',
    neighborhood: 'Centro',
    city: 'São Paulo', 
    uf: 'SP',
    cep: '01001-000',
    status: 'Ativo', 
    type: 'Pessoa Física',
    document: '123.456.789-09',
    pisNisNit: '170.33259.50-4',
    contractSigned: true,
    proxySigned: true,
    isMinor: false
  },
]

function ClientCombobox({ clients, value, onChange, placeholder }: { clients: {id: number, name: string, document?: string | null}[], value: string | null, onChange: (name: string) => void, placeholder?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchTerm(value)
    } else {
      setSearchTerm('')
    }
  }, [value])

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

  const filteredClients = clients.filter(client => {
    const term = removeAccents(searchTerm).toLowerCase()
    if (!term) return true
    return removeAccents(client.name?.toLowerCase() || '').includes(term) || 
           removeAccents(client.document?.toLowerCase() || '').includes(term)
  })

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
          {filteredClients.length > 0 ? (
            filteredClients.map(client => (
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
              Nenhum cliente encontrado.
            </div>
          )}
        </div>
      )}
    </div>
  )
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

export default function ClientesPage() {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedBirthdayClient, setSelectedBirthdayClient] = useState<Client | null>(null)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
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
    legalRepresentative: ''
  })
  const [errors, setErrors] = useState<{ document?: string; pis?: string; cep?: string }>({})
  const [isSearchingCEP, setIsSearchingCEP] = useState(false)
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
  const [selectedClients, setSelectedClients] = useState<number[]>([])
  
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const filteredClients = clients.filter(client => {
    if (!selectedFilter) return true;
    if (selectedFilter === 'total') return true;
    if (selectedFilter === 'minors') return client.isMinor;
    if (selectedFilter === 'assisted') return !!client.legalRepresentative;
    if (selectedFilter === 'health') return !!(client.name && client.email && client.document);
    return true;
  });

  const toggleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredClients.map(c => c.id));
    }
  };

  const toggleSelectClient = (id: number) => {
    setSelectedClients(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    const fetchClients = async () => {
      if (!isSupabaseConfigured) {
        setMounted(true)
        return
      }

      setIsLoading(true)

      try {
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        if (debouncedSearchTerm) {
          // Tenta usar a RPC primeiro (busca avançada com unaccent)
          const currentEnv = getAppEnv()
          const { data, error, count } = await supabase.rpc('search_clients', { 
            search_term: debouncedSearchTerm,
            p_environment: currentEnv
          }, { count: 'exact' })
          
          if (error) {
             console.warn('RPC search_clients falhou ou não existe, tentando filtro padrão...', error.message)
             // Fallback para filtro padrão com OR (case insensitive, mas sensível a acentos dependendo do collation)
             const { data: fallbackData, error: fallbackError, count: fallbackCount } = await supabase
               .from('clients')
               .select('*', { count: 'exact' })
               .or(`name.ilike.%${debouncedSearchTerm}%,email.ilike.%${debouncedSearchTerm}%,document.ilike.%${debouncedSearchTerm}%`)
               .order('name')
               .range(from, to)
               
             if (fallbackError) throw fallbackError
             setClients(fallbackData || [])
             setTotalCount(fallbackCount || 0)
          } else {
             // RPC doesn't support pagination directly via range easily without modifying the RPC, 
             // so we slice the result for now.
             setClients((data || []).slice(from, to + 1))
             setTotalCount(count || (data ? data.length : 0))
          }
        } else {
          // Busca todos se não houver termo
          const { data, error, count } = await supabase
            .from('clients')
            .select('*', { count: 'exact' })
            .order('name')
            .range(from, to)
          
          if (error) throw error
          setClients(data || [])
          setTotalCount(count || 0)
        }
      } catch (error: any) {
        console.error('Error fetching clients:', error.message || error)
      } finally {
        setIsLoading(false)
        setMounted(true)
      }
    }

    fetchClients()
  }, [debouncedSearchTerm, page, pageSize])

  if (!mounted) return null

  const handleOpenModal = (client?: Client) => {
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
        isMinor: false,
        legalRepresentative: '',
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
      })
    }
    setIsModalOpen(true)
  }

  const handleDocumentChange = (value: string) => {
    const formatted = formData.type === 'Pessoa Física' ? formatCPF(value) : formatCNPJ(value)
    setFormData({ ...formData, document: formatted })
    setErrors({ ...errors, document: undefined })
  }

  const handlePISChange = (value: string) => {
    const formatted = formatPIS(value)
    setFormData({ ...formData, pisNisNit: formatted })
    setErrors({ ...errors, pis: undefined })
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
          // Focus the addressNumber field if address was found
          if (data.logradouro) {
            setTimeout(() => {
              const numberInput = document.getElementById('addressNumber')
              if (numberInput) numberInput.focus()
            }, 100)
          }
        }
      } catch (error) {
        setErrors(prev => ({ ...prev, cep: 'Erro ao buscar CEP.' }))
      } finally {
        setIsSearchingCEP(false)
      }
    }
  }

  const checkConflictOfInterest = async (name: string, document: string) => {
    if (!name) return null;
    
    try {
      // Check for similar names in clients (excluding current if editing)
      let query = supabase
        .from('clients')
        .select('name, document')
        .ilike('name', `%${name}%`)
      
      if (editingClient) {
        query = query.neq('id', editingClient.id)
      }
      
      const { data: similarClients } = await query;
      
      if (similarClients && similarClients.length > 0) {
        return `Atenção: Já existe um cliente com nome similar (${similarClients[0].name}). Verifique se não é a mesma pessoa.`
      }

      // Check for similar names in processes (as opposing party or client)
      const { data: similarProcesses } = await supabase
        .from('processes')
        .select('number, client')
        .ilike('client', `%${name}%`)
        .limit(1)

      if (similarProcesses && similarProcesses.length > 0) {
        return `Atenção: O nome ${name} aparece no processo ${similarProcesses[0].number}. Verifique se há conflito de interesses.`
      }

      return null;
    } catch (error) {
      console.error("Error checking conflicts:", error)
      return null;
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
      updated_by: user?.id || null
    }

    // Check for conflicts before saving
    if (!conflictWarning) {
      const warning = await checkConflictOfInterest(formData.name, formData.document);
      if (warning) {
        setConflictWarning(warning);
        setPendingSubmitData(clientData);
        return; // Stop submission to show warning
      }
    }

    await executeSubmit(clientData);
  }

  const executeSubmit = async (clientData: any) => {
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
        setIsModalOpen(false)
        setConflictWarning(null)
        setPendingSubmitData(null)
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
        setIsModalOpen(false)
        setConflictWarning(null)
        setPendingSubmitData(null)
      }
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()

    // 1. Verificar dependências em todas as tabelas relacionadas
    setIsLoading(true)
    try {
      // 1. Verificar dependências na tabela 'contracts'
      const { data, error } = await supabase
        .from('contracts')
        .select('id')
        .eq('client_id', id)
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
          setClients(prev => prev.filter(c => String(c.id) !== String(id)))
        }
      }
    } catch (error) {
      console.error('Error checking dependencies or deleting client:', error)
      alert('Erro ao processar exclusão.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <ModuleHeader 
          icon={Users}
          title="Clientes" 
          description="Gerencie sua base de clientes e contatos."
        />
        
        <ClientStatsWidget 
          clients={clients} 
          onFilterChange={setSelectedFilter} 
          selectedFilter={selectedFilter}
        />

        <button 
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
            <Plus size={20} />
            Novo Cliente
          </button>

        {!isSupabaseConfigured && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800">
            <AlertTriangle className="text-amber-500 shrink-0" size={20} />
            <p className="text-sm">
              <strong>Supabase não configurado:</strong> Configure as variáveis de ambiente 
              <code className="mx-1 bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> e 
              <code className="mx-1 bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 
              no painel do AI Studio para que os dados sejam salvos.
            </p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, email, CPF ou CNPJ..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {['Processos Ativos', 'Pendências', 'Aniversariantes'].map(filter => (
              <button 
                key={filter}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {selectedClients.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-900">
            <span className="font-medium">{selectedClients.length} clientes selecionados</span>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-50">Exportar</button>
              <button className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700">Excluir Selecionados</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse hidden md:table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 w-10">
                    <input type="checkbox" className="rounded border-slate-300" checked={selectedClients.length === filteredClients.length && filteredClients.length > 0} onChange={toggleSelectAll} />
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Cliente</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Documento</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Indicadores</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-indigo-600" size={24} />
                        <p>Buscando clientes...</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client, index) => (
                    <motion.tr 
                      key={client.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedClient(client)}
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="rounded border-slate-300" checked={selectedClients.includes(client.id)} onChange={() => toggleSelectClient(client.id)} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                            client.contractSigned ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                          )}>
                            {client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 block truncate">{client.name}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="text-xs text-slate-500 flex items-center gap-1"><Mail size={12} /> {client.email}</span>
                              <span className="text-xs text-slate-500 flex items-center gap-1"><Phone size={12} /> {client.phone}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {client.document}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", Math.round((Number(!!client.email) + Number(!!client.document) + Number(!!client.phone) + Number(!!client.address)) * 25) > 50 ? "bg-emerald-500" : "bg-amber-500")} />
                          <span className="text-sm font-medium text-slate-700">
                            {Math.round((Number(!!client.email) + Number(!!client.document) + Number(!!client.phone) + Number(!!client.address)) * 25)}%
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-medium",
                            client.status === 'Ativo' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                          )}>
                            {client.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ClientActions 
                          client={client} 
                          onEdit={() => handleOpenModal(client)}
                          onDelete={() => handleDelete(new Event('click') as any, client.id)}
                          onBirthday={() => setSelectedBirthdayClient(client)}
                        />
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
            
            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-12 text-center text-slate-500">
                  <Loader2 className="animate-spin text-indigo-600 mx-auto" size={24} />
                  <p>Buscando clientes...</p>
                </div>
              ) : (
                filteredClients.map((client) => (
                  <div key={client.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                          {client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{client.name}</div>
                          <div className="text-xs text-slate-400">{client.type}</div>
                        </div>
                      </div>
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        client.status === 'Ativo' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                      )}>
                        {client.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">
                      <span className="font-medium text-slate-500">Doc:</span> {client.document}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Mail size={14} />
                        {client.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Phone size={14} />
                        {client.phone}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button 
                        onClick={() => setSelectedBirthdayClient(client)}
                        className="px-3 py-1.5 bg-pink-50 text-pink-600 rounded-lg text-xs font-medium hover:bg-pink-100"
                      >
                        Gerar Card
                      </button>
                      <Link 
                        href={`/clientes/${client.id}`}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100"
                      >
                        Ver Perfil
                      </Link>
                      <button 
                        onClick={() => handleOpenModal(client)}
                        className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, client.id)}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-medium hover:bg-rose-100"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {filteredClients.length === 0 && !isLoading && (
            <div className="p-12 text-center">
              <h3 className="text-lg font-semibold text-slate-900">Nenhum cliente encontrado</h3>
            </div>
          )}
          
          {/* Pagination */}
          {!isLoading && totalCount > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Mostrando <span className="font-medium">{(page - 1) * pageSize + 1}</span> a <span className="font-medium">{Math.min(page * pageSize, totalCount)}</span> de <span className="font-medium">{totalCount}</span> resultados
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button 
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * pageSize >= totalCount}
                  className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
        
        <ClientSlideOver 
          client={selectedClient} 
          isOpen={!!selectedClient} 
          onClose={() => setSelectedClient(null)} 
        />
        
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => {
            setIsModalOpen(false)
            setConflictWarning(null)
            setPendingSubmitData(null)
          }} 
          title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
          className="max-w-4xl"
        >
          {conflictWarning ? (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-semibold text-amber-800">Possível Conflito de Interesses</h4>
                  <p className="text-sm text-amber-700 mt-1">{conflictWarning}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => {
                    setConflictWarning(null)
                    setPendingSubmitData(null)
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors font-medium"
                >
                  Revisar Dados
                </button>
                <button 
                  type="button"
                  onClick={() => executeSubmit(pendingSubmitData)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors font-medium"
                >
                  Ignorar e Salvar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Dados Principais */}
              <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">Dados Principais e Contato</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Cliente</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value, document: '' })}
                  >
                    <option>Pessoa Física</option>
                    <option>Pessoa Jurídica</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo / Razão Social</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {formData.type === 'Pessoa Física' ? 'CPF' : 'CNPJ'}
                  </label>
                  <input 
                    required
                    type="text" 
                    className={cn(
                      "w-full px-4 py-2 border rounded-xl focus:ring-2 outline-none transition-all",
                      errors.document ? "border-rose-500 focus:ring-rose-500/20" : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500"
                    )}
                    value={formData.document || ''}
                    onChange={e => handleDocumentChange(e.target.value)}
                    placeholder={formData.type === 'Pessoa Física' ? '000.000.000-00' : '00.000.000/0000-00'}
                  />
                  {errors.document && <p className="text-xs text-rose-500 mt-1">{errors.document}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Celular / WhatsApp</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">Endereço</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    CEP
                    {isSearchingCEP && <Loader2 size={14} className="animate-spin text-indigo-600" />}
                  </label>
                  <input 
                    type="text" 
                    className={cn(
                      "w-full px-4 py-2 border rounded-xl focus:ring-2 outline-none transition-all",
                      errors.cep ? "border-rose-500 focus:ring-rose-500/20" : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500"
                    )}
                    value={formData.cep || ''}
                    onChange={e => handleCEPChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  {errors.cep && <p className="text-xs text-rose-500 mt-1">{errors.cep}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.address || ''}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
                  <input 
                    id="addressNumber"
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.addressNumber || ''}
                    onChange={e => setFormData({ ...formData, addressNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Complemento</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.addressComplement || ''}
                    onChange={e => setFormData({ ...formData, addressComplement: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bairro</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.neighborhood || ''}
                    onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.city || ''}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">UF</label>
                  <input 
                    type="text" 
                    maxLength={2}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none uppercase"
                    value={formData.uf || ''}
                    onChange={e => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            </div>

            {/* Informações Adicionais */}
            {formData.type === 'Pessoa Física' && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">Informações Adicionais</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Estado Civil</label>
                    <select 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      value={formData.civilStatus}
                      onChange={e => setFormData({ ...formData, civilStatus: e.target.value })}
                    >
                      <option>Solteiro(a)</option>
                      <option>Casado(a)</option>
                      <option>Divorciado(a)</option>
                      <option>Viúvo(a)</option>
                      <option>União Estável</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Profissão</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      value={formData.profession || ''}
                      onChange={e => setFormData({ ...formData, profession: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      value={formData.birthDate || ''}
                      onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Senha Meu INSS</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      value={formData.inssPassword || ''}
                      onChange={e => setFormData({ ...formData, inssPassword: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">PIS / NIS / NIT</label>
                    <input 
                      type="text" 
                      className={cn(
                        "w-full px-4 py-2 border rounded-xl focus:ring-2 outline-none transition-all",
                        errors.pis ? "border-rose-500 focus:ring-rose-500/20" : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500"
                      )}
                      value={formData.pisNisNit || ''}
                      onChange={e => handlePISChange(e.target.value)}
                      placeholder="000.00000.00-0"
                    />
                    {errors.pis && <p className="text-xs text-rose-500 mt-1">{errors.pis}</p>}
                  </div>
                  <div className="flex items-center gap-4 pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        checked={formData.isMinor}
                        onChange={e => setFormData({ ...formData, isMinor: e.target.checked })}
                      />
                      <span className="text-sm font-medium text-slate-700">Menor de Idade</span>
                    </label>
                  </div>
                </div>

                {formData.isMinor && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <label className="block text-sm font-medium text-slate-700 mb-1">Representante Legal (Selecione na base)</label>
                    <ClientCombobox 
                      clients={clients.filter(c => !editingClient || c.id !== editingClient.id)}
                      value={formData.legalRepresentative || ''}
                      onChange={(name) => setFormData({ ...formData, legalRepresentative: name })}
                      placeholder="Pesquisar representante..."
                    />
                  </motion.div>
                )}
              </div>
            )}

            {/* Status e Documentação */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">Status e Documentação</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    checked={formData.contractSigned}
                    onChange={e => setFormData({ ...formData, contractSigned: e.target.checked })}
                  />
                  <span className="text-sm font-medium text-slate-700">Contrato Assinado</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    checked={formData.proxySigned}
                    onChange={e => setFormData({ ...formData, proxySigned: e.target.checked })}
                  />
                  <span className="text-sm font-medium text-slate-700">Procuração Assinada</span>
                </label>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select 
                    className="w-full px-4 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option>Ativo</option>
                    <option>Inativo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  setConflictWarning(null)
                  setPendingSubmitData(null)
                }}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-md"
              >
                {editingClient ? 'Salvar Alterações' : 'Criar Cliente'}
              </button>
            </div>
          </form>
          )}
        </Modal>

        <BirthdayCardGenerator 
          isOpen={!!selectedBirthdayClient}
          onClose={() => setSelectedBirthdayClient(null)}
          clientName={selectedBirthdayClient?.name || ''}
          clientId={selectedBirthdayClient ? `client_${selectedBirthdayClient.id}` : ''}
          onGenerated={async (id) => {
            // Log generation if needed, similar to BirthdayChecker
            try {
              const numericId = parseInt(id.replace(/\D/g, ''), 10)
              if (numericId && !isNaN(numericId)) {
                await supabase.from('marketing_logs').insert([{
                  client_id: numericId,
                  type: 'birthday_card_client'
                }])
              }
            } catch (e) {
              console.error('Erro ao salvar log no Supabase:', e)
            }
            setSelectedBirthdayClient(null)
          }}
        />
      </div>
    </DashboardLayout>
  )
}


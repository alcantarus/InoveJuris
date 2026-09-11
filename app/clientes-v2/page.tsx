'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { SlideOver } from '@/app/components/SlideOver'
import { 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  Loader2, 
  AlertTriangle,
  Edit2,
  Trash2,
  Users
} from 'lucide-react'
import { motion } from 'motion/react'
import { validateCPF, validateCNPJ, validatePIS, formatCPF, formatCNPJ, formatCEP, formatPhone, removeAccents, cn } from '@/lib/utils'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'

// ... (Interface Client and other logic remains the same as in /app/clientes/page.tsx)
// I will copy the interface and necessary logic here to make it functional.

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

export default function ClientesPageV2() {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)
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
        const { data, error } = await supabase.from('clients').select('*').order('name')
        if (error) throw error
        setClients(data || [])
      } catch (error: any) {
        console.error('Error fetching clients:', error.message)
      } finally {
        setIsLoading(false)
        setMounted(true)
      }
    }
    fetchClients()
  }, [])

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
        legalRepresentative: client.legalRepresentative || ''
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
        legalRepresentative: ''
      })
    }
    setIsSlideOverOpen(true)
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
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return
    
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) {
      console.error('Error deleting client:', error)
      alert('Erro ao excluir cliente.')
    } else {
      setClients(prev => prev.filter(c => c.id !== id))
    }
  }

  const filteredClients = clients.filter(c => 
    removeAccents(c.name.toLowerCase()).includes(removeAccents(searchTerm.toLowerCase())) ||
    (c.document && c.document.includes(searchTerm))
  )

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
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Cliente</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Documento</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedClients.map(client => (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium">{client.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{client.document}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleOpenSlideOver(client)} className="p-2 hover:text-indigo-600"><Edit2 size={18}/></button>
                    <button onClick={() => handleDelete(client.id)} className="p-2 text-rose-500 hover:text-rose-700"><Trash2 size={18}/></button>
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
                <input className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.cep} onChange={e => setFormData({...formData, cep: e.target.value})} />
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
                  <input className="w-full px-4 py-2 border border-slate-200 rounded-xl" value={formData.legalRepresentative} onChange={e => setFormData({...formData, legalRepresentative: e.target.value})} />
                </div>
              )}
            </div>
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700">Salvar</button>
          </form>
        </SlideOver>
      </div>
    </DashboardLayout>
  )
}

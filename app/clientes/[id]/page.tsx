'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashboardLayout from '../../dashboard-layout'
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  Briefcase, 
  CreditCard, 
  History, 
  Tag, 
  Plus,
  MessageCircle,
  PhoneCall,
  Video,
  Calendar,
  Download,
  Trash2,
  Edit2,
  Link as LinkIcon
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import { formatCurrency, formatDate, cn, getTodayBR } from '@/lib/utils'
import { motion } from 'motion/react'

export default function ClientProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const clientId = params.id as string

  const [client, setClient] = useState<any>(null)
  const [processes, setProcesses] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [interactions, setInteractions] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const [showInteractionModal, setShowInteractionModal] = useState(false)
  const [showLinkProcessModal, setShowLinkProcessModal] = useState(false)
  const [availableProcesses, setAvailableProcesses] = useState<any[]>([])
  const [selectedProcessId, setSelectedProcessId] = useState<string>('')
  const [isLinkingProcess, setIsLinkingProcess] = useState(false)
  const [newInteraction, setNewInteraction] = useState({
    type: 'Call',
    notes: '',
    date: ''
  })

  useEffect(() => {
    setNewInteraction(prev => ({
      ...prev,
      date: getTodayBR()
    }))
  }, [])
  const [isSubmittingInteraction, setIsSubmittingInteraction] = useState(false)

  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [showTagModal, setShowTagModal] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTag.trim()) return
    setIsAddingTag(true)
    try {
      const { data, error } = await supabase
        .from('client_tags')
        .insert([{ client_id: clientId, tag: newTag.trim() }])
        .select()
        .single()
      if (error) throw error
      setTags([...tags, data])
      setNewTag('')
      setShowTagModal(false)
    } catch (error) {
      console.error('Error adding tag:', error)
      alert('Erro ao adicionar tag.')
    } finally {
      setIsAddingTag(false)
    }
  }

  useEffect(() => {
    const fetchClientData = async () => {
      if (!isSupabaseConfigured || !clientId) return

      try {
        // Fetch Client
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .single()

        if (clientError) throw clientError
        setClient(clientData)

        // Fetch Processes
        const { data: processesData } = await supabase
          .from('processes')
          .select('*')
          .eq('client_id', clientId)
        setProcesses(processesData || [])

        // Fetch Contracts
        const { data: contractsData } = await supabase
          .from('contracts')
          .select('*')
          .eq('client_id', clientId)
        setContracts(contractsData || [])

        // Fetch Interactions
        const { data: interactionsData } = await supabase
          .from('client_interactions')
          .select('*, users(name)')
          .eq('client_id', clientId)
          .order('date', { ascending: false })
        setInteractions(interactionsData || [])

        // Fetch Documents
        const { data: docsData } = await supabase
          .from('client_documents')
          .select('*')
          .eq('client_id', clientId)
          .order('uploaded_at', { ascending: false })
        setDocuments(docsData || [])

        // Fetch Tags
        const { data: tagsData } = await supabase
          .from('client_tags')
          .select('*')
          .eq('client_id', clientId)
        setTags(tagsData || [])

      } catch (error) {
        console.error('Error fetching client data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchClientData()
  }, [clientId])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!client) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-slate-700">Cliente não encontrado</h2>
          <button onClick={() => router.push('/clientes')} className="mt-4 text-indigo-600 hover:underline">Voltar para Clientes</button>
        </div>
      </DashboardLayout>
    )
  }

  const handleGenerateOnboardingLink = async () => {
    console.log('Iniciando geração de link de onboarding para clientId:', clientId);
    try {
      const token = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

      const dataToInsert = {
          client_id: parseInt(clientId, 10),
          token,
          expires_at: expiresAt.toISOString(),
          environment: getAppEnv()
      };
      console.log('Dados para inserir:', dataToInsert);

      const { data, error } = await supabase
        .from('client_onboarding_tokens')
        .insert([dataToInsert])

      if (error) {
        console.error('Erro detalhado do Supabase:', error);
        throw error;
      }

      console.log('Inserção bem-sucedida:', data);

      const url = `${window.location.origin}/onboarding/${token}`
      await navigator.clipboard.writeText(url)
      alert('Link de onboarding gerado e copiado para a área de transferência!')
    } catch (error) {
      console.error('Error generating onboarding link:', error)
      alert('Erro ao gerar link de onboarding: ' + (error as any).message)
    }
  }

  const fetchAvailableProcesses = async () => {
    const { data, error } = await supabase
      .from('processes')
      .select('*')
      .is('client_id', null)
    if (error) {
      console.error('Error fetching available processes:', error)
      return
    }
    setAvailableProcesses(data || [])
    setShowLinkProcessModal(true)
  }

  const handleLinkProcess = async () => {
    if (!selectedProcessId) return
    setIsLinkingProcess(true)
    try {
      const { error } = await supabase
        .from('processes')
        .update({ client_id: clientId })
        .eq('id', selectedProcessId)
      if (error) throw error
      
      // Update local state
      const linkedProcess = availableProcesses.find(p => p.id === Number(selectedProcessId))
      setProcesses([...processes, linkedProcess])
      setShowLinkProcessModal(false)
      setSelectedProcessId('')
    } catch (error) {
      console.error('Error linking process:', error)
      alert('Erro ao vincular processo.')
    } finally {
      setIsLinkingProcess(false)
    }
  }

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingInteraction(true)
    try {
      const { data, error } = await supabase
        .from('client_interactions')
        .insert([{
          client_id: clientId,
          type: newInteraction.type,
          notes: newInteraction.notes,
          date: newInteraction.date,
          user_id: user?.id,
          environment: getAppEnv()
        }])
        .select('*, users(name)')
        .single()

      if (error) throw error

      setInteractions([data, ...interactions])
      setShowInteractionModal(false)
      setNewInteraction({ type: 'Call', notes: '', date: getTodayBR() })
    } catch (error) {
      console.error('Error adding interaction:', error)
      alert('Erro ao registrar interação.')
    } finally {
      setIsSubmittingInteraction(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `${clientId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('client_documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('client_documents')
        .getPublicUrl(filePath)

      const { data, error: dbError } = await supabase
        .from('client_documents')
        .insert([{
          client_id: clientId,
          file_url: publicUrl,
          document_type: file.name,
          created_by: user?.id,
          environment: getAppEnv()
        }])
        .select()
        .single()

      if (dbError) throw dbError

      setDocuments([data, ...documents])
      alert('Documento adicionado com sucesso!')
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Erro ao fazer upload do documento.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const totalContractValue = contracts.reduce((acc, curr) => acc + Number(curr.contractValue || 0), 0)

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        {/* Header / Back Button */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/clientes')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Perfil do Cliente</h1>
          </div>
        </div>

        {/* Client Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-2xl shrink-0">
                {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  {client.name}
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium",
                    client.status === 'Ativo' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                  )}>
                    {client.status}
                  </span>
                </h2>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                  <div className="flex items-center gap-1.5"><Mail size={14} /> {client.email || 'Sem e-mail'}</div>
                  <div className="flex items-center gap-1.5"><Phone size={14} /> {client.phone || 'Sem telefone'}</div>
                  <div className="flex items-center gap-1.5"><User size={14} /> {client.document || 'Sem documento'}</div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={handleGenerateOnboardingLink}
                className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-medium hover:bg-slate-100 transition-colors flex items-center gap-2"
                title="Gerar Link de Atualização Cadastral"
              >
                <LinkIcon size={18} /> Link Onboarding
              </button>
              <button className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-medium hover:bg-emerald-100 transition-colors flex items-center gap-2">
                <MessageCircle size={18} /> WhatsApp
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2">
                <Edit2 size={18} /> Editar
              </button>
            </div>
          </div>
          
          {/* Tags */}
          <div className="mt-6 flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag.id} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium flex items-center gap-1">
                <Tag size={12} /> {tag.tag}
              </span>
            ))}
            <button 
              onClick={() => setShowTagModal(true)}
              className="px-3 py-1 border border-dashed border-slate-300 text-slate-500 rounded-full text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              <Plus size={12} /> Adicionar Tag
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-200 hide-scrollbar">
          {[
            { id: 'overview', label: 'Visão Geral', icon: User },
            { id: 'processes', label: 'Processos', icon: Briefcase },
            { id: 'contracts', label: 'Contratos & Financeiro', icon: CreditCard },
            { id: 'documents', label: 'Documentos', icon: FileText },
            { id: 'history', label: 'Histórico (CRM)', icon: History },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id 
                  ? "border-indigo-600 text-indigo-600" 
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Informações Pessoais</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                    <div>
                      <p className="text-sm text-slate-500">Tipo</p>
                      <p className="font-medium text-slate-900">{client.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Estado Civil</p>
                      <p className="font-medium text-slate-900">{client.civilStatus || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Profissão</p>
                      <p className="font-medium text-slate-900">{client.profession || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Data de Nascimento</p>
                      <p className="font-medium text-slate-900">{client.birthDate ? formatDate(client.birthDate) : '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-slate-500">Endereço</p>
                      <p className="font-medium text-slate-900">
                        {client.address ? `${client.address}, ${client.addressNumber} ${client.addressComplement ? '- ' + client.addressComplement : ''} - ${client.neighborhood}, ${client.city}/${client.uf} - CEP: ${client.cep}` : 'Não informado'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Resumo</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Processos Ativos</span>
                      <span className="font-bold text-slate-900">{processes.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Contratos</span>
                      <span className="font-bold text-slate-900">{contracts.length}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                      <span className="text-slate-500">Valor Total em Contratos</span>
                      <span className="font-bold text-indigo-600">{formatCurrency(totalContractValue)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'processes' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Processos Vinculados</h3>
                <button 
                  onClick={fetchAvailableProcesses}
                  className="text-sm text-indigo-600 font-medium hover:underline"
                >
                  Vincular Processo
                </button>
              </div>
              {processes.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Número</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Tipo</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processes.map(proc => (
                      <tr key={proc.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-indigo-600">{proc.number}</td>
                        <td className="px-6 py-4 text-slate-600">{proc.type}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">{proc.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-500">Nenhum processo vinculado a este cliente.</div>
              )}
            </div>
          )}

          {activeTab === 'contracts' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Contratos</h3>
                <button className="text-sm text-indigo-600 font-medium hover:underline">Novo Contrato</button>
              </div>
              {contracts.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Produto/Serviço</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Data</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Valor</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {contracts.map(contract => (
                      <tr key={contract.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-900">{contract.product}</td>
                        <td className="px-6 py-4 text-slate-600">{contract.contractDate ? formatDate(contract.contractDate) : '-'}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{formatCurrency(contract.contractValue)}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">{contract.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-500">Nenhum contrato encontrado.</div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-900">Documentos do Cliente</h3>
                <div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-medium hover:bg-indigo-100 transition-colors flex items-center gap-2 text-sm disabled:opacity-70"
                  >
                    {isUploading ? (
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Plus size={16} />
                    )}
                    {isUploading ? 'Enviando...' : 'Adicionar Documento'}
                  </button>
                </div>
              </div>
              {documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {documents.map(doc => (
                    <div key={doc.id} className="border border-slate-200 rounded-xl p-4 flex items-start gap-3 hover:border-indigo-300 transition-colors group cursor-pointer" onClick={() => window.open(doc.file_url, '_blank')}>
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <FileText size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{doc.document_type || 'Documento'}</p>
                        <p className="text-xs text-slate-500">{formatDate(doc.uploaded_at)}</p>
                      </div>
                      <button className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Download size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                  <FileText className="mx-auto text-slate-300 mb-3" size={48} />
                  <p className="text-slate-500 font-medium">Nenhum documento anexado</p>
                  <p className="text-sm text-slate-400 mt-1">Clique no botão acima para adicionar arquivos.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-900">Histórico de Interações</h3>
                <button 
                  onClick={() => setShowInteractionModal(true)}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-medium hover:bg-indigo-100 transition-colors flex items-center gap-2 text-sm"
                >
                  <Plus size={16} /> Registrar Interação
                </button>
              </div>
              
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {interactions.length > 0 ? interactions.map(interaction => (
                  <div key={interaction.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      {interaction.type === 'Call' && <PhoneCall size={18} />}
                      {interaction.type === 'Email' && <Mail size={18} />}
                      {interaction.type === 'Meeting' && <Video size={18} />}
                      {interaction.type === 'WhatsApp' && <MessageCircle size={18} />}
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">{interaction.type}</span>
                        <span className="text-xs text-slate-500">{formatDate(interaction.date)}</span>
                      </div>
                      <p className="text-sm text-slate-600">{interaction.notes}</p>
                      {interaction.users?.name && (
                        <p className="text-xs text-slate-400 mt-2">Por {interaction.users.name}</p>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-slate-500 relative z-10 bg-white">
                    Nenhuma interação registrada.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Registrar Interação */}
      {showInteractionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Registrar Interação</h2>
              <button 
                onClick={() => setShowInteractionModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddInteraction} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Interação</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={newInteraction.type}
                  onChange={e => setNewInteraction({...newInteraction, type: e.target.value})}
                  required
                >
                  <option value="Call">Ligação</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Email">E-mail</option>
                  <option value="Meeting">Reunião</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={newInteraction.date}
                  onChange={e => setNewInteraction({...newInteraction, date: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Anotações</label>
                <textarea 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                  rows={4}
                  value={newInteraction.notes}
                  onChange={e => setNewInteraction({...newInteraction, notes: e.target.value})}
                  placeholder="Descreva os detalhes da interação..."
                  required
                ></textarea>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowInteractionModal(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingInteraction}
                  className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmittingInteraction ? 'Salvando...' : 'Salvar Interação'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal Vincular Processo */}
      {showLinkProcessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Vincular Processo</h2>
              <button 
                onClick={() => setShowLinkProcessModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Selecione o Processo</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={selectedProcessId}
                  onChange={e => setSelectedProcessId(e.target.value)}
                >
                  <option value="">Selecione um processo...</option>
                  {availableProcesses.map(proc => (
                    <option key={proc.id} value={proc.id}>{proc.number} - {proc.type}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowLinkProcessModal(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleLinkProcess}
                  disabled={isLinkingProcess || !selectedProcessId}
                  className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-70 flex items-center gap-2"
                >
                  {isLinkingProcess ? 'Vinculando...' : 'Vincular'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {showTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Adicionar Tag</h2>
              <button 
                onClick={() => setShowTagModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddTag} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Tag</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  placeholder="Ex: Prioridade Alta"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowTagModal(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isAddingTag}
                  className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-70 flex items-center gap-2"
                >
                  {isAddingTag ? 'Salvando...' : 'Salvar Tag'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  )
}

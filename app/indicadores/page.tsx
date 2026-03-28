'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit2,
  AlertTriangle,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { formatCPF, formatCNPJ, formatPhone, cn, formatDate, formatCurrency, removeAccents } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { usePrivacy } from '@/components/providers/PrivacyProvider'

interface Indicator {
  id: number
  name: string
  phone: string
  cpf: string | null
  pixKey: string
  email: string
  data_nascimento: string | null
  created_at: string
  indicator_tokens?: { token: string }[]
}

interface Contract {
  id: number
  client_id: number
  clients: { name: string }
  contractDate: string
  contractValue: number
  base_comissao: number
  commissionPercent: number
  commissionValue: number
  commissionPaid: boolean
}

export default function IndicadoresPage() {
  const { isVisible } = usePrivacy()
  const { user } = useAuth()
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null)
  const [mounted, setMounted] = useState(false)

  // Commission Modal State
  const [commissionsModalOpen, setCommissionsModalOpen] = useState(false)
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null)
  const [indicatorContracts, setIndicatorContracts] = useState<Contract[]>([])

  const [formData, setFormData] = useState<Partial<Indicator>>({
    name: '',
    phone: '',
    cpf: '',
    pixKey: '',
    email: '',
    data_nascimento: ''
  })

  const [pixKeyType, setPixKeyType] = useState('CPF')

  useEffect(() => {
    const fetchIndicators = async () => {
      if (!isSupabaseConfigured) {
        setMounted(true)
        return
      }

      const { data, error } = await supabase
        .from('indicators')
        .select('*, indicator_tokens(token)')
        .order('name')
      
      if (error) {
        console.error('Error fetching indicators:', error.message || error)
      } else {
        setIndicators(data || [])
      }
      setMounted(true)
    }

    fetchIndicators()
  }, [])

  const handleGenerateToken = async (indicatorId: number) => {
    const { data, error } = await supabase
      .from('indicator_tokens')
      .insert({ indicator_id: indicatorId })
      .select('token')
      .single()
    
    if (error) {
      // Check for unique constraint violation (Postgres code 23505, HTTP 409, or message check)
      const isUniqueViolation = error.code === '23505' || 
                               (error as any).status === 409 || 
                               (error.message && error.message.includes('unique constraint'));

      if (isUniqueViolation) {
        // Token já existe, buscar o existente
        const { data: existingData, error: fetchError } = await supabase
          .from('indicator_tokens')
          .select('token')
          .eq('indicator_id', indicatorId);
        
        if (fetchError) {
          console.error('Error fetching existing token:', fetchError)
          alert('Erro ao buscar token existente.')
        } else if (existingData && existingData.length > 0) {
          setIndicators(prev => prev.map(i => i.id === indicatorId ? { ...i, indicator_tokens: [{ token: existingData[0].token }] } : i))
        } else {
          console.error('Token não encontrado apesar da violação de unique constraint.')
          alert('O Token não pode ser gerado, porque o Indicador não tem comissões a receber.')
        }
      } else {
        console.error('Error generating token:', error)
        alert('Erro ao gerar token.')
      }
    } else {
      setIndicators(prev => prev.map(i => i.id === indicatorId ? { ...i, indicator_tokens: [{ token: data.token }] } : i))
    }
  }

  const handleOpenModal = (indicator?: Indicator) => {
    if (indicator) {
      setEditingIndicator(indicator)
      setFormData(indicator)
      // Try to guess pix key type
      if (indicator.pixKey.includes('@')) setPixKeyType('E-mail')
      else if (indicator.pixKey.length > 20) setPixKeyType('Chave Aleatória')
      else if (indicator.pixKey.length > 11) setPixKeyType('CNPJ') // Rough guess
      else setPixKeyType('CPF')
    } else {
      setEditingIndicator(null)
      setFormData({
        name: '',
        phone: '',
        cpf: '',
        pixKey: '',
        email: '',
        data_nascimento: ''
      })
      setPixKeyType('CPF')
    }
    setIsModalOpen(true)
  }

  const handlePixKeyChange = (value: string) => {
    let formatted = value
    switch (pixKeyType) {
      case 'Telefone':
        formatted = formatPhone(value)
        break
      case 'CPF':
        formatted = formatCPF(value)
        break
      case 'CNPJ':
        formatted = formatCNPJ(value)
        break
      case 'E-mail':
      case 'Chave Aleatória':
      default:
        formatted = value
        break
    }
    setFormData({ ...formData, pixKey: formatted })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isSupabaseConfigured) {
      alert('Supabase não configurado. Não é possível salvar.')
      return
    }

    if (editingIndicator) {
      // Remove id, created_at, indicator_tokens from update payload to avoid errors
      const { id, created_at, indicator_tokens, ...updateData } = formData as any
      updateData.cpf = updateData.cpf || null
      updateData.data_nascimento = updateData.data_nascimento || null
      
      const { data, error } = await supabase
        .from('indicators')
        .update({ ...updateData, updated_by: user?.id || null })
        .eq('id', editingIndicator.id)
        .select()
      
      if (error) {
        console.error('Error updating indicator:', error)
        alert('Erro ao atualizar indicador.')
      } else {
        if (data) {
          setIndicators(prev => prev.map(i => i.id === editingIndicator.id ? data[0] : i))
        }
        setIsModalOpen(false)
      }
    } else {
      const { id, created_at, indicator_tokens, ...dataToInsert } = formData as any
      const insertData = { ...dataToInsert, cpf: dataToInsert.cpf || null, data_nascimento: dataToInsert.data_nascimento || null, created_by: user?.id || null, updated_by: user?.id || null }
      const { data, error } = await supabase
        .from('indicators')
        .insert([insertData])
        .select()
      
      if (error) {
        console.error('Error creating indicator:', error)
        alert(`Erro ao criar indicador: ${error.message || error.details || JSON.stringify(error)}`)
      } else {
        if (data) {
          setIndicators(prev => [...prev, data[0]])
        }
        setIsModalOpen(false)
      }
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm('Tem certeza que deseja excluir este indicador?')) {
      const { error } = await supabase
        .from('indicators')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error('Error deleting indicator:', error)
        alert('Erro ao excluir indicador.')
      } else {
        setIndicators(prev => prev.filter(i => String(i.id) !== String(id)))
      }
    }
  }

  const [commissionStatus, setCommissionStatus] = useState<any[]>([])
  const [paymentValues, setPaymentValues] = useState<Record<number, string>>({})
  const [paymentDescriptions, setPaymentDescriptions] = useState<Record<number, string>>({})

  const handleOpenCommissions = async (indicator: Indicator) => {
    setSelectedIndicator(indicator)
    setIndicatorContracts([])
    setCommissionStatus([])
    setPaymentValues({})
    setPaymentDescriptions({})
    
    if (isSupabaseConfigured) {
      const [contractsRes, statusRes] = await Promise.all([
        supabase
          .from('contracts')
          .select('id, client_id, clients(name), contractDate, contractValue, base_comissao, commissionPercent, commissionValue, commissionPaid')
          .eq('indicator_id', indicator.id)
          .order('contractDate', { ascending: false }),
        supabase
          .from('vw_indicator_commission_status')
          .select('*')
          .eq('indicator_id', indicator.id)
      ])
      
      if (contractsRes.error) {
        console.error('Error fetching contracts for indicator:', contractsRes.error)
        alert('Erro ao buscar comissões.')
      } else {
        setIndicatorContracts(contractsRes.data as any || [])
      }
      if (statusRes.data) {
        setCommissionStatus(statusRes.data)
      }
    }
    
    setCommissionsModalOpen(true)
  }

  const handleAddPayment = async (contractId: number) => {
    const amountPaid = paymentValues[contractId] ? parseFloat(paymentValues[contractId].replace(/\./g, '').replace(',', '.')) : 0
    if (!amountPaid || amountPaid <= 0) return toast.error('Informe um valor válido')

    // Find remaining balance
    const status = commissionStatus.find(s => s.contract_id === contractId)
    const remainingBalance = status?.remaining_balance || 0

    if (amountPaid > remainingBalance) {
      return toast.error(`O valor pago (R$ ${amountPaid.toFixed(2)}) não pode ser maior que o saldo devedor (R$ ${Number(remainingBalance).toFixed(2)})!`)
    }

    if (!selectedIndicator) {
      toast.error('Indicador não selecionado')
      return
    }

    const payload = {
      contract_id: contractId,
      indicator_id: selectedIndicator.id,
      amount_paid: amountPaid,
      description: paymentDescriptions[contractId] || ''
    }
    console.log('Inserting commission payment:', payload)

    const { error } = await supabase.from('commission_payments').insert(payload)

    if (error) return alert('Erro ao registrar pagamento')
    
    toast.success('Pagamento registrado!')
    setPaymentValues(prev => ({ ...prev, [contractId]: '' }))
    setPaymentDescriptions(prev => ({ ...prev, [contractId]: '' }))
    handleOpenCommissions(selectedIndicator!)
  }

  const formatCurrencyMask = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const floatValue = parseFloat(numericValue) / 100;
    return isNaN(floatValue) ? '0,00' : floatValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  const handleToggleCommissionStatus = async (contractId: number, currentStatus: boolean) => {
    if (!isSupabaseConfigured) return

    const { error } = await supabase
      .from('contracts')
      .update({ commissionPaid: !currentStatus })
      .eq('id', contractId)
    
    if (error) {
      console.error('Error updating commission status:', error)
      alert('Erro ao atualizar status da comissão.')
    } else {
      setIndicatorContracts(prev => prev.map(c => 
        c.id === contractId ? { ...c, commissionPaid: !currentStatus } : c
      ))
    }
  }

  const filteredIndicators = indicators.filter(i => {
    const term = removeAccents(searchTerm).toLowerCase()
    return removeAccents(i.name.toLowerCase()).includes(term) ||
           (i.cpf && removeAccents(i.cpf).includes(term)) ||
           removeAccents(i.email.toLowerCase()).includes(term)
  })

  if (!mounted) return null

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <ModuleHeader 
          icon={DollarSign}
          title="Indicadores" 
          description="Gerencie os parceiros e indicadores de clientes."
        />
        <button 
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          Novo Indicador
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

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome, CPF ou e-mail..." 
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-sm text-slate-500">
                  <th className="p-4 font-medium">Nome</th>
                  <th className="p-4 font-medium">CPF</th>
                  <th className="p-4 font-medium">Contato</th>
                  <th className="p-4 font-medium">Chave PIX</th>
                  <th className="p-4 font-medium">Portal</th>
                  <th className="p-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIndicators.map((indicator, index) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={indicator.id} 
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="p-4">
                      <div className="font-medium text-slate-900">{indicator.name}</div>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-600">{indicator.cpf}</span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-900">{indicator.phone}</div>
                      <div className="text-xs text-slate-500">{indicator.email}</div>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-600">{indicator.pixKey}</span>
                    </td>
                    <td className="p-4">
                      {indicator.indicator_tokens && indicator.indicator_tokens.length > 0 ? (
                        <button 
                          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/portal/indicador/${indicator.indicator_tokens![0].token}`)}
                          className="text-xs text-indigo-600 hover:underline"
                          title="Copiar Link"
                        >
                          Copiar Link
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleGenerateToken(indicator.id)}
                          className="text-xs bg-slate-100 px-2 py-1 rounded hover:bg-slate-200"
                        >
                          Gerar Token
                        </button>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenCommissions(indicator)}
                          className="p-2 text-slate-600 md:text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 bg-slate-50 md:bg-transparent rounded-lg transition-colors"
                          title="Ver Comissões"
                        >
                          <DollarSign size={18} />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(indicator)}
                          className="p-2 text-slate-600 md:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 bg-slate-50 md:bg-transparent rounded-lg transition-colors"
                          title="Editar Indicador"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, indicator.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Excluir Indicador"
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
          {filteredIndicators.length === 0 && (
            <div className="p-12 text-center">
              <h3 className="text-lg font-semibold text-slate-900">Nenhum indicador encontrado</h3>
            </div>
          )}
        </div>

        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingIndicator ? 'Editar Indicador' : 'Novo Indicador'}
          className="max-w-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
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
                <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={formData.cpf || ''}
                  onChange={e => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                  placeholder="000.000.000-00"
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={formData.data_nascimento || ''}
                  onChange={e => setFormData({ ...formData, data_nascimento: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Chave PIX</label>
                <select 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                  value={pixKeyType}
                  onChange={e => {
                    setPixKeyType(e.target.value)
                    setFormData({ ...formData, pixKey: '' }) // Clear value on type change
                  }}
                >
                  <option>CPF</option>
                  <option>CNPJ</option>
                  <option>Telefone</option>
                  <option>E-mail</option>
                  <option>Chave Aleatória</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chave PIX</label>
                <input 
                  required
                  type={pixKeyType === 'E-mail' ? 'email' : 'text'} 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={formData.pixKey || ''}
                  onChange={e => handlePixKeyChange(e.target.value)}
                  placeholder={
                    pixKeyType === 'CPF' ? '000.000.000-00' :
                    pixKeyType === 'CNPJ' ? '00.000.000/0000-00' :
                    pixKeyType === 'Telefone' ? '(00) 00000-0000' :
                    pixKeyType === 'E-mail' ? 'exemplo@email.com' :
                    'Chave aleatória'
                  }
                />
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
                {editingIndicator ? 'Salvar Alterações' : 'Cadastrar Indicador'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Commissions Modal */}
        <Modal
          isOpen={commissionsModalOpen}
          onClose={() => setCommissionsModalOpen(false)}
          title={`Comissões - ${selectedIndicator?.name}`}
          className="max-w-4xl"
        >
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-500 font-medium">Total de Comissões Geradas</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(
                    indicatorContracts.reduce((acc, c) => acc + Number(c.commissionValue || 0), 0),
                    isVisible('indicators_commissions')
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500 font-medium">A Pagar</p>
                {commissionStatus.reduce((acc, s) => acc + Number(s.remaining_balance || 0), 0) > 0 ? (
                  <p className="text-2xl font-bold text-indigo-600">
                    {formatCurrency(
                      commissionStatus.reduce((acc, s) => acc + Number(s.remaining_balance || 0), 0),
                      isVisible('indicators_commissions')
                    )}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-slate-500 italic">O Indicador não tem comissões a receber.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="p-4">Contrato</th>
                      <th className="p-4 text-right">Base Comissão</th>
                      <th className="p-4 text-right">Total Comissão</th>
                      <th className="p-4 text-right">Total Pago</th>
                      <th className="p-4 text-right">Saldo Devedor</th>
                      <th className="p-4 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {indicatorContracts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          Nenhum contrato encontrado para este indicador.
                        </td>
                      </tr>
                    ) : (
                      indicatorContracts.map((contract) => {
                        const status = commissionStatus.find(s => s.contract_id === contract.id)
                        return (
                          <tr key={contract.id} className={cn("hover:bg-slate-50/50 transition-colors", (status?.remaining_balance || 0) <= 0 && "bg-emerald-50")}>
                            <td className="p-4">
                              <div className="font-medium text-slate-900">{contract.clients?.name || 'Cliente Removido'}</div>
                              <div className="text-xs text-slate-400">ID: {contract.id}</div>
                            </td>
                            <td className="p-4 text-right font-medium text-slate-900">
                              {formatCurrency(contract.base_comissao, isVisible('indicators_commissions'))}
                            </td>
                            <td className="p-4 text-right font-medium text-slate-900">
                              {formatCurrency(status?.total_commission || 0, isVisible('indicators_commissions'))}
                            </td>
                            <td className="p-4 text-right font-medium text-slate-900">
                              {formatCurrency(status?.total_paid || 0, isVisible('indicators_commissions'))}
                            </td>
                            <td className="p-4 text-right font-bold text-emerald-600">
                              {formatCurrency(status?.remaining_balance || 0, isVisible('indicators_commissions'))}
                            </td>
                            <td className="p-4 text-center">
                              {(status?.remaining_balance || 0) > 0 ? (
                                <div className="flex flex-col gap-2">
                                  <input 
                                    type="text" 
                                    placeholder="R$ 0,00" 
                                    className="w-32 px-2 py-1 border rounded"
                                    value={paymentValues[contract.id] || ''}
                                    onChange={e => setPaymentValues(prev => ({ ...prev, [contract.id]: formatCurrencyMask(e.target.value) }))}
                                  />
                                  <input 
                                    type="text" 
                                    placeholder="Descrição" 
                                    className="w-32 px-2 py-1 border rounded text-xs"
                                    value={paymentDescriptions[contract.id] || ''}
                                    onChange={e => setPaymentDescriptions(prev => ({ ...prev, [contract.id]: e.target.value }))}
                                  />
                                  <button 
                                    className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                                    onClick={() => handleAddPayment(contract.id)}
                                  >
                                    Pagar
                                  </button>
                                </div>
                              ) : (
                                <span className="text-emerald-700 font-semibold text-sm">Quitado</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  )
}

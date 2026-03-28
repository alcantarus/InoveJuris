'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import DashboardLayout from '../dashboard-layout'
import { ModuleHeader } from '@/components/ModuleHeader'
import { 
  DollarSign, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Download,
  MoreVertical,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  FileText,
  User,
  Search,
  History,
  Wallet,
  X,
  Ban,
  Eye,
  EyeOff,
  Scale
} from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import { KPICard } from '@/components/ui/KPICard'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { cn, formatProcessNumber, formatDate, formatCurrency, removeAccents, getStatusColor } from '@/lib/utils'
import { usePrivacy } from '@/components/providers/PrivacyProvider'
import { AutoResizeText } from '@/components/ui/AutoResizeText'

interface Contract {
  id: number
  client_id: number | null
  product_id?: number | null
  status: string
  launchDate: string
  contractDate: string
  processNumber: string
  contractValue: number
  base_comissao: number
  paymentMethod: string
  installmentsCount: number
  contractSigned: boolean
  proxySigned: boolean
  inssProtocol: string
  gpsGenerated: boolean
  gpsPaid: boolean
  inssDeferred: boolean
  childbirthDate: string
  indicator_id: number | null
  commissionPercent: number
  commissionValue: number
  amountReceivable: number
  amountReceived: number
  observations: string
  isProBono?: boolean
  isFinanced?: boolean
  gps_forecast_date?: string | null
  gps_payment_date?: string | null
  gps_value?: number | null
  lawyer_id?: number | null
  created_at: string
  clients?: { name: string }
  indicators?: { name: string }
  products?: { name: string, law_areas?: { name: string } }
  installments?: Installment[]
  product?: string
  lawArea?: string
}

interface Installment {
  id?: number
  contract_id?: number
  installmentNumber: number
  dueDate: string
  original_due_date?: string
  amount: number
  amountPaid: number
  status: string
  interest: number
  fine: number
}

interface Product {
  id: number
  name: string
  law_area_id: number | null
  law_areas?: { name: string }
}

function CurrencyInput({ value, onChange, disabled, className, placeholder }: any) {
  const [displayValue, setDisplayValue] = useState('')

  useEffect(() => {
    if (value !== undefined && value !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayValue(formatCurrency(value, true))
    } else {
      setDisplayValue('')
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (!val) {
      setDisplayValue('')
      onChange(0)
      return
    }
    const num = Number(val) / 100
    setDisplayValue(formatCurrency(num, true))
    onChange(num)
  }

  return (
    <input
      type="text"
      className={className}
      value={displayValue}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
    />
  )
}

import { useAuth } from '@/lib/auth'

function ClientCombobox({ clients, value, onChange }: { clients: {id: number, name: string, document?: string}[], value: number | null, onChange: (id: number | null) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  // Sync searchTerm with value only when value changes externally
  useEffect(() => {
    const client = clients.find(c => c.id === value)
    if (client) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchTerm(client.name)
    } else if (value === null) {
      setSearchTerm('')
    }
  }, [value, clients])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        // Revert to selected value name if no new selection was made
        const client = clients.find(c => c.id === value)
        setSearchTerm(client ? client.name : '')
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [clients, value])

  const filteredClients = clients.filter(client => {
    const term = removeAccents(searchTerm).toLowerCase()
    if (!term) return true

    const nameMatch = removeAccents(client.name?.toLowerCase() || '').includes(term)
    const docMatch = removeAccents(client.document?.toLowerCase() || '').includes(term)
    
    // Only match by digits if search term has digits to avoid matching everyone when typing letters
    const searchDigits = term.replace(/\D/g, '')
    const docDigitsMatch = searchDigits.length > 0 && 
      (client.document?.replace(/\D/g, '') || '').includes(searchDigits)

    return nameMatch || docMatch || docDigitsMatch
  })

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none pl-10"
          placeholder="Buscar cliente por nome ou CPF/CNPJ..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
            // We don't call onChange(null) here to avoid clearing the parent state 
            // and triggering the useEffect that would reset our searchTerm
          }}
          onFocus={() => setIsOpen(true)}
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        {searchTerm && (
            <button 
                type="button"
                onClick={() => {
                    onChange(null)
                    setSearchTerm('')
                    setIsOpen(true)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
                <X size={16} />
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
                  onChange(client.id)
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

export default function FinanceiroPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isVisible, toggleVisibility } = usePrivacy()
  const { user } = useAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [clients, setClients] = useState<{id: number, name: string, document?: string}[]>([])
  const [indicators, setIndicators] = useState<{id: number, name: string}[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [lawyers, setLawyers] = useState<any[]>([])
  const [filter, setFilter] = useState('Todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [estornoModalOpen, setEstornoModalOpen] = useState(false)
  const [estornoIndex, setEstornoIndex] = useState<number | null>(null)
  const [estornoReason, setEstornoReason] = useState('')
  const [estornoObs, setEstornoObs] = useState('')
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  
  // Cancel Contract State
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [contractToCancel, setContractToCancel] = useState<Contract | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelConfirmation, setCancelConfirmation] = useState('')
  const [cancelError, setCancelError] = useState('')

  // Cash Flow Integration State
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [financialCategories, setFinancialCategories] = useState<any[]>([])

  // Payment/Liquidation State (Unified)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentData, setPaymentData] = useState({
    index: null as number | null,
    amount: 0,
    totalDue: 0,
    date: new Date().toISOString().split('T')[0],
    account_id: '',
    category_id: '',
    description: '',
    interest: 0,
    fine: 0,
    observation: ''
  })

  const [mounted, setMounted] = useState(false)

  // Form State
  const [formData, setFormData] = useState<Partial<Contract> & { product_id?: number | null, hasGpsControl?: boolean }>({
    client_id: null,
    product_id: null,
    status: 'Aberto',
    product: '',
    launchDate: new Date().toISOString().split('T')[0],
    contractDate: new Date().toISOString().split('T')[0],
    lawArea: '',
    processNumber: '',
    contractValue: 0,
    base_comissao: 0,
    paymentMethod: 'À Vista',
    installmentsCount: 1,
    isProBono: false,
    isFinanced: false,
    hasGpsControl: false,
    gps_forecast_date: null,
    gps_payment_date: null,
    gps_value: null,
    contractSigned: false,
    proxySigned: false,
    inssProtocol: '',
    gpsGenerated: false,
    gpsPaid: false,
    inssDeferred: false,
    childbirthDate: '',
    indicator_id: null,
    commissionPercent: 0,
    commissionValue: 0,
    amountReceivable: 0,
    amountReceived: 0,
    lawyer_id: null as number | null,
    observations: ''
  })
  const [installments, setInstallments] = useState<Installment[]>([])
  const installmentsRef = useRef<Installment[]>(installments)

  const isMaternidade = formData.product?.toLowerCase().includes('maternidade');

  useEffect(() => {
    installmentsRef.current = installments
  }, [installments])

  useEffect(() => {
    const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setMounted(true)
      return
    }

    const currentEnv = document.documentElement.dataset.env || 'production';
    console.log('Fetching data for environment:', currentEnv);

    const [contractsRes, clientsRes, indicatorsRes, productsRes, accountsRes, categoriesRes, lawyersRes] = await Promise.all([
        supabase.from('contracts').select('*, clients(name), indicators(name), installments(*)').order('created_at', { ascending: false }),
        supabase.from('clients').select('id, name, document').order('name'),
        supabase.from('indicators').select('id, name').order('name'),
        supabase.from('products').select('*, law_areas(name)').order('name'),
        supabase.from('bank_accounts').select('id, name').order('name'),
        supabase.from('financial_categories').select('id, name').eq('type', 'income').order('name'),
        supabase.from('lawyers').select('id, user_id, users:user_id(name)')
      ])
      
      console.log('[Contratos] Dados recebidos do Supabase:', {
        contractsCount: contractsRes.data?.length,
        firstContract: contractsRes.data?.[0]
      });
      
      if (contractsRes.error) console.error('Error fetching contracts:', contractsRes.error)
      else setContracts(contractsRes.data || [])

      if (clientsRes.data) setClients(clientsRes.data)
      if (indicatorsRes.data) setIndicators(indicatorsRes.data)
      if (productsRes.data) setProducts(productsRes.data)
      if (accountsRes.data) setBankAccounts(accountsRes.data)
      if (categoriesRes.data) setFinancialCategories(categoriesRes.data)
      if (lawyersRes.data) setLawyers(lawyersRes.data)

      setMounted(true)
    }

    fetchData()
  }, [])

  const calculatedCommission = (Number(formData.base_comissao || 0) * Number(formData.commissionPercent || 0)) / 100

  const generateInstallments = () => {
    const isProBono = formData.isProBono
    const totalValue = isProBono ? 0 : Number(formData.contractValue || 0)
    
    if ((formData.paymentMethod === 'Parcelado' && formData.installmentsCount) || formData.paymentMethod === 'À Prazo') {
      const count = formData.paymentMethod === 'À Prazo' ? 1 : Number(formData.installmentsCount)
      const baseVal = Math.floor((totalValue / count) * 100) / 100
      const newInstallments: Installment[] = []
      
      let currentDate = new Date(formData.contractDate || new Date())
      
      for (let i = 1; i <= count; i++) {
        currentDate.setMonth(currentDate.getMonth() + 1)
        const isLast = i === count
        const amount = isLast ? Number((totalValue - (baseVal * (count - 1))).toFixed(2)) : baseVal

        newInstallments.push({
          installmentNumber: i,
          dueDate: currentDate.toISOString().split('T')[0],
          original_due_date: currentDate.toISOString().split('T')[0],
          amount: amount,
          amountPaid: isProBono ? amount : 0,
          status: isProBono ? 'Quitado' : 'Aberto',
          interest: 0,
          fine: 0
        })
      }
      setInstallments(newInstallments)
    } else if (formData.paymentMethod === 'À Vista') {
      setInstallments([{
        installmentNumber: 1,
        dueDate: formData.contractDate || new Date().toISOString().split('T')[0],
        original_due_date: formData.contractDate || new Date().toISOString().split('T')[0],
        amount: totalValue,
        amountPaid: isProBono ? totalValue : 0,
        status: isProBono ? 'Quitado' : 'Aberto',
        interest: 0,
        fine: 0
      }])
    }
  }

  const handleProductChange = (productId: number | null) => {
    if (!productId) {
      setFormData({
        ...formData,
        product_id: null,
        product: '',
        lawArea: ''
      })
      return
    }
    const product = products.find(p => p.id === productId)
    if (product) {
      setFormData({
        ...formData,
        product_id: product.id,
        product: product.name,
        lawArea: product.law_areas?.name || ''
      })
    } else {
      setFormData({
        ...formData,
        product_id: null,
        product: '',
        lawArea: ''
      })
    }
  }

  const handleOpenModal = async (contract?: Contract) => {
    if (contract) {
      if (contract.status === 'Quitado' || contract.status === 'Cancelado') {
        toast.error(`Contratos com status '${contract.status}' não podem ser editados.`);
        return;
      }
      setEditingContract(contract)
      
      // Resolve product and law area from the products list
      const product = products.find(p => p.id === contract.product_id)
      
      setFormData({
        ...contract,
        product: product?.name || '',
        lawArea: product?.law_areas?.name || '',
        hasGpsControl: !!(contract.gps_forecast_date || contract.gpsGenerated || contract.gpsPaid || contract.gps_value)
      })
      // Fetch installments for this contract
      if (isSupabaseConfigured) {
        const { data } = await supabase.from('installments').select('*').eq('contract_id', contract.id).order('installmentNumber')
        if (data) setInstallments(data)
      }
    } else {
      setEditingContract(null)
      setFormData({
        client_id: null,
        product_id: null,
        product: '',
        launchDate: new Date().toISOString().split('T')[0],
        contractDate: new Date().toISOString().split('T')[0],
        lawArea: '',
        processNumber: '',
        contractValue: 0,
        paymentMethod: 'À Vista',
        installmentsCount: 1,
        contractSigned: false,
        proxySigned: false,
        inssProtocol: '',
        hasGpsControl: false,
        gpsGenerated: false,
        gpsPaid: false,
        gps_forecast_date: null,
        gps_payment_date: null,
        gps_value: null,
        inssDeferred: false,
        childbirthDate: '',
        indicator_id: null,
        commissionPercent: 0,
        commissionValue: 0,
        amountReceivable: 0,
        amountReceived: 0,
        lawyer_id: null,
        observations: ''
      })
      setInstallments([])
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingContract && (editingContract.status === 'Quitado' || editingContract.status === 'Cancelado')) {
      alert('Não é possível editar um contrato que já está Quitado ou Cancelado.')
      return
    }

    if (!formData.client_id) {
      alert('Por favor, selecione um cliente.')
      return
    }

    if (!isSupabaseConfigured) {
      alert('Supabase não configurado.')
      return
    }

    const isMaternidade = formData.product?.toLowerCase().includes('maternidade')

    if (isMaternidade && !formData.childbirthDate) {
      alert('Para o produto Salário-Maternidade, a Data do Parto é obrigatória.')
      return
    }

    // Calculate amount received and receivable based on installments
    const currentInstallments = installmentsRef.current
    const received = currentInstallments.reduce((acc, i) => acc + Number(i.amountPaid || 0), 0)
    // Receivable is contract value minus received
    const receivable = Math.max(0, Number(formData.contractValue || 0) - received)

    // Determine contract status based on installments
    let contractStatus = formData.status || 'Aberto'
    if (contractStatus !== 'Cancelado') {
      const allCanceled = currentInstallments.length > 0 && currentInstallments.every(i => i.status === 'Cancelado')
      const allPaid = currentInstallments.length > 0 && currentInstallments.every(i => i.status === 'Quitado' || i.status === 'Cancelado') && currentInstallments.some(i => i.status === 'Quitado')
      const somePaid = currentInstallments.some(i => i.amountPaid > 0)
      const hasEstornado = currentInstallments.some(i => {
        const s = i.status?.toLowerCase().trim();
        return s === 'estornado' || s === 'estornada' || s === 'estorno';
      });
      const hasProrrogado = currentInstallments.some(i => {
        const s = i.status?.toLowerCase().trim();
        return s === 'prorrogada' || s === 'prorrogado';
      });
      
      if (hasEstornado) {
        contractStatus = 'Estornado'
      } else if (allCanceled) {
        contractStatus = 'Cancelado'
      } else if (hasProrrogado) {
        contractStatus = 'Prorrogado'
      } else if (allPaid) {
        contractStatus = 'Quitado'
      } else if (somePaid) {
        contractStatus = 'Parcial'
      } else {
        contractStatus = 'Aberto'
      }
    }

    const contractData = {
      client_id: formData.client_id,
      product_id: formData.product_id,
      product: formData.product || 'Não informado',
      lawArea: formData.lawArea || 'Não informada',
      status: formData.isProBono ? 'Quitado' : contractStatus,
      launchDate: formData.launchDate || null,
      contractDate: formData.contractDate || null,
      processNumber: formData.processNumber || null,
      contractValue: formData.contractValue || 0,
      base_comissao: formData.base_comissao || 0,
      paymentMethod: formData.paymentMethod || 'À Vista',
      installmentsCount: formData.paymentMethod === 'Parcelado' ? (formData.installmentsCount || 1) : 1,
      isProBono: formData.isProBono || false,
      isFinanced: formData.isFinanced || false,
      contractSigned: formData.contractSigned || false,
      proxySigned: formData.proxySigned || false,
      inssProtocol: formData.inssProtocol || null,
      gpsGenerated: formData.hasGpsControl ? (formData.gpsGenerated || false) : false,
      gpsPaid: formData.hasGpsControl ? (formData.gpsPaid || false) : false,
      gps_forecast_date: formData.hasGpsControl ? (formData.gps_forecast_date || null) : null,
      gps_payment_date: formData.hasGpsControl ? (formData.gps_payment_date || null) : null,
      gps_value: formData.hasGpsControl ? (formData.gps_value || null) : null,
      inssDeferred: formData.inssDeferred || false,
      childbirthDate: isMaternidade ? (formData.childbirthDate || null) : null,
      indicator_id: formData.indicator_id || null,
      lawyer_id: formData.lawyer_id || null,
      commissionPercent: formData.isProBono ? 0 : (formData.commissionPercent || 0),
      commissionValue: formData.isProBono ? 0 : calculatedCommission,
      amountReceivable: formData.isProBono ? 0 : receivable,
      amountReceived: formData.isProBono ? 0 : received,
      observations: formData.isProBono 
        ? (formData.observations ? `PROBONO - ${formData.observations}` : 'PROBONO') 
        : formData.isFinanced
          ? (formData.observations ? `FINANCIADO - ${formData.observations}` : 'FINANCIADO')
          : (formData.observations || null),
      updated_by: user?.id || null
    }

    if (!editingContract) {
      (contractData as any).created_by = user?.id || null
    }

    console.log('[Contratos] Iniciando salvamento do contrato. FormData:', JSON.stringify(formData, null, 2));
    console.log('[Contratos] Payload final (contractData):', JSON.stringify(contractData, null, 2));
    
    if (editingContract) {
      console.log('[Contratos] Atualizando contrato ID:', editingContract.id);
      const { data: cData, error: cError } = await supabase
        .from('contracts')
        .update(contractData)
        .eq('id', editingContract.id)
        .select('*, clients(name), indicators(name)')
      
      if (cError) {
        console.error('[Contratos] Erro ao atualizar contrato:', cError);
        alert(`Erro ao atualizar contrato: ${cError.message}`)
        return
      }
      console.log('[Contratos] Contrato atualizado com sucesso:', cData);

      // Update installments
      // Use upsert logic instead of delete/recreate to preserve IDs and payment history
      console.log('Installments to upsert:', installments);
      
      // Filter out installments that are already 'Quitado' or 'Cancelado' and have an ID
      // This prevents the backend trigger from blocking the entire transaction when saving GPS data
      const installmentsToUpsert = installments.filter(i => {
        if (!i.id) return true; // Always upsert new installments
        return i.status !== 'Quitado' && i.status !== 'Cancelado';
      });

      const instData = installmentsToUpsert.map(i => ({
        ...(i.id ? { id: i.id } : {}),
        contract_id: editingContract.id,
        installmentNumber: i.installmentNumber,
        dueDate: i.dueDate,
        amount: i.amount,
        amountPaid: i.amountPaid,
        status: i.status,
        interest: i.interest,
        fine: i.fine,
        updated_by: user?.id || null,
        created_by: i.id ? undefined : (user?.id || null)
      }))

      if (instData.length > 0) {
        console.log('Upserting instData:', instData);
        const { error: upsertError } = await supabase.from('installments').upsert(instData)
        if (upsertError) {
          console.error('Error upserting installments:', upsertError)
          alert(`Erro ao salvar parcelas: ${upsertError.message}`)
        }
      } else {
        console.log('No installments to upsert');
      }

      // Delete installments that are no longer in the list AND have no payments
      const currentIds = installments.filter(i => i.id).map(i => i.id)
      if (currentIds.length > 0) {
        await supabase.from('installments')
          .delete()
          .eq('contract_id', editingContract.id)
          .not('id', 'in', `(${currentIds.join(',')})`)
          .eq('"amountPaid"', 0)
      }

      if (cData && cData[0]) {
        setContracts(prev => prev.map(c => c.id === editingContract.id ? { ...cData[0], installments: installments } : c))
      }
      setIsModalOpen(false)
    } else {
      const { data: cData, error: cError } = await supabase
        .from('contracts')
        .insert([contractData])
        .select('*, clients(name), indicators(name)')
      
      if (cError) {
        console.error(cError)
        alert(`Erro ao criar contrato: ${cError.message}`)
        return
      }

      if (cData && cData[0]) {
        const newContractId = cData[0].id
        const instData = currentInstallments.map(i => ({
          contract_id: newContractId,
          installmentNumber: i.installmentNumber,
          dueDate: i.dueDate,
          amount: i.amount,
          amountPaid: i.amountPaid,
          status: i.status,
          interest: i.interest,
          fine: i.fine,
          created_by: user?.id || null,
          updated_by: user?.id || null
        }))
        if (instData.length > 0) {
          const { error: iError } = await supabase.from('installments').insert(instData)
          if (iError) {
            console.error('Error creating installments:', iError)
            alert(`Contrato criado, mas erro ao gerar parcelas: ${iError.message}`)
          }
        }
        setContracts(prev => [{ ...cData[0], installments: currentInstallments }, ...prev])
      }
      setIsModalOpen(false)
    }
  }

  const handleCancelClick = async (e: React.MouseEvent, contract: Contract) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Check if contract is already canceled or paid
    if (contract.status === 'Cancelado' || contract.status === 'Quitado') {
      alert(`Este contrato está com status '${contract.status}' e não pode ser cancelado.`)
      return
    }

    // Check if contract has any installments that are not in a pristine unpaid state
    const { data: insts, error } = await supabase.from('installments').select('*').eq('contract_id', contract.id)
    if (error) {
      console.error(error)
      alert('Erro ao verificar parcelas do contrato.')
      return
    }

    const allowedStatuses = ['Aberto', 'Atrasada']
    const hasNonCancellableInstallments = insts?.some((i: Installment) => !allowedStatuses.includes(i.status) || i.amountPaid > 0)
    
    if (hasNonCancellableInstallments || contract.status === 'Quitado' || contract.status === 'Parcial') {
      alert('Não é possível cancelar títulos com pagamentos atrelados, estornados ou prorrogados. Estorne os pagamentos primeiro.')
      return
    }

    setContractToCancel(contract)
    setCancelReason('')
    setCancelConfirmation('')
    setCancelError('')
    setCancelModalOpen(true)
  }

  const executeCancelContract = async () => {
    if (!contractToCancel) return
    
    if (!cancelReason.trim()) {
      setCancelError('A observação/motivo do cancelamento é obrigatória.')
      return
    }

    if (cancelConfirmation !== 'CANCELAR') {
      setCancelError('Digite CANCELAR para confirmar a operação.')
      return
    }

    try {
      if (isSupabaseConfigured) {
        const { error: rpcError } = await supabase.rpc('process_contract_cancellation', {
          p_contract_id: contractToCancel.id,
          p_reason: cancelReason,
          p_user_id: user?.id || null
        })

        if (rpcError) throw rpcError

        // Update local state
        const updatedObs = contractToCancel.observations 
          ? `${contractToCancel.observations}\n\n[CANCELAMENTO]: ${cancelReason}` 
          : `[CANCELAMENTO]: ${cancelReason}`

        setContracts(prev => prev.map(c => 
          c.id === contractToCancel.id 
            ? { ...c, status: 'Cancelado', observations: updatedObs } 
            : c
        ))

        setCancelModalOpen(false)
        setContractToCancel(null)
      }
    } catch (error: any) {
      console.error('Error canceling contract:', error)
      setCancelError(`Erro ao cancelar contrato: ${error.message || 'Tente novamente.'}`)
    }
  }

  const handleOpenEstorno = (index: number) => {
    setEstornoIndex(index)
    setEstornoReason('')
    setEstornoObs('')
    setEstornoModalOpen(true)
  }

  const handleConfirmEstorno = async () => {
    if (estornoIndex !== null) {
      const inst = installments[estornoIndex]
      
      if (!inst.id) {
        alert('Erro: ID da parcela não encontrado.')
        return
      }

      const accountId = paymentData.account_id || bankAccounts[0]?.id
      if (!accountId) {
        alert('Selecione uma conta bancária para o lançamento do estorno.')
        return
      }

      // 1. Call RPC for transactional estorno
      if (isSupabaseConfigured) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('process_installment_estorno', {
            p_installment_id: inst.id,
            p_reason: `${estornoReason} - ${estornoObs} (por ${user?.name})`,
            p_account_id: Number(accountId),
            p_user_id: user?.id || null
          })

          if (rpcError) throw rpcError

          // 2. Wait a short delay for DB triggers to settle
          // This prevents the "Aberto" status from overwriting our "Estornado" status
          await new Promise(resolve => setTimeout(resolve, 800));

          // 3. Force status to 'Estornado' for the installment in the database
          await supabase
            .from('installments')
            .update({ 
              status: 'Estornado', 
              '"amountPaid"': 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', inst.id)

          // 4. Force contract status to 'Estornado' in the database
          await supabase
            .from('contracts')
            .update({ 
              status: 'Estornado',
              updated_at: new Date().toISOString()
            })
            .eq('id', inst.contract_id)

          // 5. Update local state immediately
          const forcedInsts = installments.map((i, idx) => 
            idx === estornoIndex ? { ...i, status: 'Estornado', amountPaid: 0 } : i
          )
          setInstallments(forcedInsts)
          
          if (rpcData) {
            const { new_received, new_receivable } = rpcData
            
            setFormData(prev => ({
              ...prev,
              amountReceived: new_received,
              amountReceivable: new_receivable,
              status: 'Estornado'
            }))

            setContracts(prev => prev.map(c => 
              c.id === inst.contract_id 
                ? { 
                    ...c, 
                    amountReceived: new_received, 
                    amountReceivable: new_receivable, 
                    status: 'Estornado', 
                    installments: forcedInsts 
                  } 
                : c
            ))
          }

          // 6. Sync with DB after a longer delay to ensure all triggers finished
          setTimeout(async () => {
            const { data: syncedInsts } = await supabase
              .from('installments')
              .select('*')
              .eq('contract_id', inst.contract_id)
              .order('installmentNumber')
            
            if (syncedInsts) {
              // Ensure we don't accidentally revert to 'Aberto' if we just estornou
              const updatedInsts = syncedInsts.map((si: any) => {
                if (si.id === inst.id) {
                  return { ...si, status: 'Estornado', amountPaid: 0 };
                }
                return si;
              });
              setInstallments(updatedInsts);
              
              // Also sync contract status
              const { data: syncedContract } = await supabase
                .from('contracts')
                .select('status, amountReceived, amountReceivable')
                .eq('id', inst.contract_id)
                .single();
              
              if (syncedContract) {
                setFormData(prev => ({
                  ...prev,
                  status: syncedContract.status === 'Aberto' ? 'Estornado' : syncedContract.status,
                  amountReceived: syncedContract.amountReceived,
                  amountReceivable: syncedContract.amountReceivable
                }));
              }
            }
          }, 2000)

          setEstornoModalOpen(false)
        } catch (err: any) {
          console.error('Error processing estorno:', err)
          alert(`Erro ao processar estorno: ${err.message || 'Erro desconhecido'}`)
        }
      }
    }
  }

  const updateInstallment = (index: number, field: string, value: any) => {
    let newInst = [...installments]
    const oldVal = newInst[index][field as keyof Installment]
    newInst[index] = { ...newInst[index], [field]: value }
    
    // Logic for prorrogação: if date changes and it's not paid, mark as Prorrogada
    if (field === 'dueDate' && oldVal !== value && (newInst[index].status === 'Aberto' || newInst[index].status === 'Atrasada')) {
      newInst[index].status = 'Prorrogada'
    }

    // Logic for partial payment / estorno
    if (field === 'status') {
      const s = String(value).toLowerCase().trim();
      if (s === 'aberto' || s === 'cancelado' || s === 'estornado' || s === 'estornada') {
        // Estorno ou cancelamento
        newInst[index].amountPaid = 0
      }
    }

    setInstallments(newInst)
  }

  const handleOpenPayment = (idx: number) => {
    const inst = installments[idx]
    const client = clients.find(c => c.id === formData.client_id)
    const remainingBalance = inst.amount - Number(inst.amountPaid || 0)
    const totalDue = remainingBalance + Number(inst.interest || 0) + Number(inst.fine || 0)
    
    setPaymentData({
      index: idx,
      amount: remainingBalance, // Default to remaining balance
      totalDue: totalDue,
      date: new Date().toISOString().split('T')[0],
      account_id: bankAccounts[0]?.id || '',
      category_id: financialCategories[0]?.id || '',
      description: `Recebimento Parcela ${inst.installmentNumber} - ${client?.name || ''}`,
      interest: inst.interest || 0,
      fine: inst.fine || 0,
      observation: ''
    })
    setPaymentModalOpen(true)
  }

  const handleConfirmPayment = async () => {
    if (paymentData.index === null) return
    
    const idx = paymentData.index
    const inst = installments[idx]
    
    if (!inst.id) {
      alert('Esta parcela ainda não foi salva no banco de dados. Salve o contrato primeiro.')
      return
    }

    if (!paymentData.account_id || !paymentData.category_id) {
      alert('Selecione a conta e a categoria para o lançamento.')
      return
    }

    // 1. Call RPC for transactional payment
    if (isSupabaseConfigured) {
      try {
        const remainingBalance = inst.amount - Number(inst.amountPaid || 0);
        const isPartialPayment = paymentData.amount < remainingBalance - 0.01;
        
        let rpcData, rpcError;

        if (isPartialPayment) {
          const { data, error } = await supabase.rpc('rpc_recebimento_com_desdobramento', {
            p_installment_id: inst.id,
            p_valor_principal_pago: paymentData.amount, // Apenas o valor do principal abatido!
            p_valor_juros: paymentData.interest || 0,
            p_valor_multa: paymentData.fine || 0,
            p_account_id: Number(paymentData.account_id),
            p_category_id: Number(paymentData.category_id),
            p_date: paymentData.date,
            p_description: paymentData.description + (paymentData.observation ? ` (${paymentData.observation})` : ''),
            p_user_id: user?.id || null
          });
          rpcData = data;
          rpcError = error;
        } else {
          const { data, error } = await supabase.rpc('process_installment_payment', {
            p_installment_id: inst.id,
            p_amount_paid: paymentData.amount + paymentData.interest + paymentData.fine, // Total paid
            p_account_id: Number(paymentData.account_id),
            p_category_id: Number(paymentData.category_id),
            p_date: paymentData.date,
            p_description: paymentData.description + (paymentData.observation ? ` (${paymentData.observation})` : ''),
            p_user_id: user?.id || null,
            p_interest: paymentData.interest,
            p_fine: paymentData.fine
          });
          rpcData = data;
          rpcError = error;
        }

        if (rpcError) throw rpcError

        // 2. Update local state with the results from RPC
        // Fetch all installments again to get the new one if partial
        const { data: updatedInsts } = await supabase
          .from('installments')
          .select('*')
          .eq('contract_id', inst.contract_id)
          .order('installmentNumber')
        
        if (updatedInsts) setInstallments(updatedInsts)

        if (rpcData) {
          const { new_received, new_receivable, new_status } = rpcData
          
          setFormData(prev => ({
            ...prev,
            amountReceived: new_received,
            amountReceivable: new_receivable,
            status: new_status
          }))

          setContracts(prev => prev.map(c => 
            c.id === inst.contract_id 
              ? { ...c, amountReceived: new_received, amountReceivable: new_receivable, status: new_status, installments: updatedInsts || c.installments } 
              : c
          ))
        }

        setPaymentModalOpen(false)
      } catch (err: any) {
        console.error('Error processing payment:', err)
        alert(`Erro ao processar pagamento: ${err.message || 'Erro desconhecido'}`)
      }
    }
  }

  const filteredContracts = contracts.filter(c => {
    const clientName = c.clients?.name || ''
    const product = products.find(p => p.id === c.product_id)
    const productName = product?.name || ''
    
    const term = removeAccents(searchTerm).toLowerCase()
    const matchesSearch = removeAccents(clientName.toLowerCase() || '').includes(term) || 
                          removeAccents(productName.toLowerCase() || '').includes(term)
    
    if (filter === 'Todos') return matchesSearch
    if (filter === 'Salário-Maternidade') return matchesSearch && productName.includes('Salário-Maternidade')
    if (filter === 'Outros') return matchesSearch && !productName.includes('Salário-Maternidade')
    return matchesSearch
  }).sort((a, b) => {
    const nextA = a.installments
      ?.filter(i => i.status === 'Aberto' || i.status === 'Atrasada' || i.status === 'Prorrogada')
      .sort((i1, i2) => new Date(i1.dueDate).getTime() - new Date(i2.dueDate).getTime())[0]
    const nextB = b.installments
      ?.filter(i => i.status === 'Aberto' || i.status === 'Atrasada' || i.status === 'Prorrogada')
      .sort((i1, i2) => new Date(i1.dueDate).getTime() - new Date(i2.dueDate).getTime())[0]

    const timeA = nextA ? new Date(nextA.dueDate).getTime() : Infinity
    const timeB = nextB ? new Date(nextB.dueDate).getTime() : Infinity

    return timeA - timeB
  })

  // Calculate totals from contracts
  const totalReceivable = contracts.reduce((acc, c) => c.status === 'Cancelado' ? acc : acc + Number(c.amountReceivable), 0)
  const totalReceived = contracts.reduce((acc, c) => c.status === 'Cancelado' ? acc : acc + Number(c.amountReceived), 0)
  const totalContracts = contracts.filter(c => c.status !== 'Cancelado').length

  // Calculate totals from installments for the modal header
  const financialSummary = useMemo(() => {
    const total = installments.reduce((acc, inst) => acc + Number(inst.amount || 0), 0)
    const saldoRemanescente = installments.reduce((acc, inst) => {
      const amount = Number(inst.amount || 0)
      const amountPaid = Number(inst.amountPaid || 0)
      return acc + Math.max(0, amount - amountPaid)
    }, 0)
    const liquidado = total - saldoRemanescente
    return { total, saldoRemanescente, liquidado }
  }, [installments])

  if (!mounted) return null

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm">
          As operações financeiras (recebimento e estorno) agora devem ser realizadas exclusivamente no módulo &quot;Contas a Receber&quot;.
        </div>
        <ModuleHeader
          icon={DollarSign}
          title="Contratos"
          description="Gestão de contratos, honorários e comissões."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
            title="Contratos Ativos" 
            value={contracts.filter(c => c.status === 'Aberto' || c.status === 'Parcial').length} 
            icon={FileText} 
            color="indigo" 
            isVisible={isVisible('contracts_active')}
            onToggleVisibility={() => toggleVisibility('contracts_active')}
          />
          <KPICard 
            title="Valor Mensal (MRR)" 
            value={formatCurrency(contracts.filter(c => c.status === 'Aberto' || c.status === 'Parcial').reduce((acc, c) => acc + Number(c.contractValue || 0), 0), isVisible('contracts_mrr'))} 
            icon={DollarSign} 
            color="emerald" 
            isVisible={isVisible('contracts_mrr')}
            onToggleVisibility={() => toggleVisibility('contracts_mrr')}
          />
          <KPICard 
            title="Renovações (30d)" 
            value={0} 
            icon={Calendar} 
            color="amber" 
            isVisible={isVisible('contracts_renewals')}
            onToggleVisibility={() => toggleVisibility('contracts_renewals')}
          />
          <KPICard 
            title="Pendentes Assinatura" 
            value={contracts.filter(c => !c.contractSigned).length} 
            icon={AlertCircle} 
            color="rose" 
            isVisible={isVisible('contracts_pending')}
            onToggleVisibility={() => toggleVisibility('contracts_pending')}
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => handleOpenModal()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={20} />
            Novo Contrato
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600">
                <ArrowUpCircle size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-500">Total Recebido</p>
                  <button 
                    onClick={(e) => { e.preventDefault(); toggleVisibility('finance_total_received'); }} 
                    className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    title={isVisible('finance_total_received') ? "Ocultar valor" : "Mostrar valor"}
                  >
                    {isVisible('finance_total_received') ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  {formatCurrency(totalReceived, isVisible('finance_total_received'))}
                </h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                <Clock size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-500">A Receber</p>
                  <button 
                    onClick={(e) => { e.preventDefault(); toggleVisibility('finance_total_receivable'); }} 
                    className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    title={isVisible('finance_total_receivable') ? "Ocultar valor" : "Mostrar valor"}
                  >
                    {isVisible('finance_total_receivable') ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  {formatCurrency(totalReceivable, isVisible('finance_total_receivable'))}
                </h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Contratos</p>
                <h3 className="text-2xl font-bold text-slate-900">{totalContracts}</h3>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por cliente ou produto..." 
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            {['Todos', 'Salário-Maternidade', 'Outros'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-3 rounded-xl font-medium whitespace-nowrap transition-all",
                  filter === f 
                    ? "bg-slate-900 text-white shadow-sm" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left border-collapse hidden md:table min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-sm text-slate-500">
                  <th className="p-4 font-medium">Cliente / Produto</th>
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">
                    <div className="flex items-center gap-1">
                      Valor
                      <button 
                        onClick={(e) => { e.preventDefault(); toggleVisibility('finance_table_value'); }} 
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {isVisible('finance_table_value') ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                    </div>
                  </th>
                  <th className="p-4 font-medium">Próximo Vencimento</th>
                  <th className="p-4 font-medium">
                    <div className="flex items-center gap-1">
                      A Receber
                      <button 
                        onClick={(e) => { e.preventDefault(); toggleVisibility('finance_table_receivable'); }} 
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {isVisible('finance_table_receivable') ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                    </div>
                  </th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Situação</th>
                  <th className="p-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContracts.map((contract, index) => {
                  // Calculate next due date
                  const nextInstallment = contract.installments
                    ?.filter(i => i.status === 'Aberto' || i.status === 'Atrasada' || i.status === 'Prorrogada' || i.status === 'Estornado')
                    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
                  
                  const isQuitado = contract.status === 'Quitado' || (Number(contract.contractValue || 0) > 0 && Number(contract.amountReceived || 0) >= Number(contract.contractValue || 0));
                  
                  const isEstornado = contract.status?.toLowerCase().trim() === 'estornado' || 
                                     contract.status?.toLowerCase().trim() === 'estornada' ||
                                     contract.installments?.some(i => {
                                       const s = i.status?.toLowerCase().trim();
                                       return s === 'estornado' || s === 'estornada' || s === 'estorno';
                                     });
                  
                  const isProrrogado = contract.status?.toLowerCase().trim() === 'prorrogado' || 
                                      contract.status?.toLowerCase().trim() === 'prorrogada' ||
                                      contract.installments?.some(i => {
                                        const s = i.status?.toLowerCase().trim();
                                        return s === 'prorrogada' || s === 'prorrogado';
                                      });
                  
                  let rowStatus = 'Normal';
                  if (isEstornado) rowStatus = 'Estornado';
                  else if (contract.status === 'Cancelado') rowStatus = 'Cancelado';
                  else if (isProrrogado) rowStatus = 'Prorrogado';
                  else if (contract.isProBono) rowStatus = 'Pro Bono';
                  else if (isQuitado) rowStatus = 'Quitado';
                  else if (contract.isFinanced) rowStatus = 'Financiado';

                  const rowColors = {
                    'Cancelado': 'bg-[#ea9999]/10 hover:bg-[#ea9999]/20',
                    'Estornado': 'bg-[#f4cccc]/20 hover:bg-[#f4cccc]/30',
                    'Pro Bono': 'bg-[#ffff00]/10 hover:bg-[#ffff00]/20',
                    'Quitado': 'bg-[#b6d7a8]/20 hover:bg-[#b6d7a8]/30',
                    'Prorrogado': 'bg-[#f9cb9c]/20 hover:bg-[#f9cb9c]/30',
                    'Financiado': 'bg-[#46bdc6]/10 hover:bg-[#46bdc6]/20',
                    'Normal': 'bg-[#cfe2f3]/20 hover:bg-[#cfe2f3]/30'
                  }[rowStatus];

                  const badgeColors = {
                    'Cancelado': 'bg-[#ea9999] text-black line-through',
                    'Estornado': 'bg-[#f4cccc] text-black',
                    'Pro Bono': 'bg-[#ffff00] text-black',
                    'Quitado': 'bg-[#b6d7a8] text-black',
                    'Prorrogado': 'bg-[#f9cb9c] text-black',
                    'Financiado': 'bg-[#46bdc6] text-black',
                    'Normal': 'bg-[#cfe2f3] text-black'
                  }[rowStatus];

                  return (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={contract.id} 
                    className={cn(
                      "transition-colors group",
                      rowColors,
                      contract.status === 'Cancelado' && "opacity-60 line-through"
                    )}
                  >
                    <td className="p-4">
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        {contract.clients?.name || 'Cliente não vinculado'}
                        {contract.isProBono && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                            Pro Bono
                          </span>
                        )}
                        {contract.isFinanced && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-800 border border-sky-200">
                            Financiado
                          </span>
                        )}
                        {!contract.isProBono && !contract.isFinanced && (
                          <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
                            rowStatus === 'Estornado' ? "bg-red-100 text-red-800 border-red-200" :
                            rowStatus === 'Prorrogado' ? "bg-amber-100 text-amber-800 border-amber-200" :
                            rowStatus === 'Quitado' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                            "bg-indigo-100 text-indigo-800 border-indigo-200"
                          )}>
                            {rowStatus}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">
                        {products.find(p => p.id === contract.product_id)?.name || 'Produto não vinculado'}
                      </div>
                      {contract.lawyer_id && (
                        <div className="text-[10px] font-medium text-slate-400 mt-0.5 flex items-center gap-1">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: lawyers.find(l => l.id === contract.lawyer_id)?.color_code || '#cbd5e1' }}
                          />
                          {lawyers.find(l => l.id === contract.lawyer_id)?.users?.name || 'Advogado'}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-900">{formatDate(contract.contractDate)}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-900">
                        {formatCurrency(contract.contractValue, isVisible('finance_table_value'))}
                      </div>
                      <div className="text-xs text-slate-500">{contract.paymentMethod}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-900">
                        {nextInstallment ? formatDate(nextInstallment.dueDate) : '-'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-indigo-600">
                        {formatCurrency(contract.amountReceivable, isVisible('finance_table_receivable'))}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {contract.gpsGenerated && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full w-fit">
                            <CheckCircle2 size={12}/> GPS Gerada {contract.gps_forecast_date && `(${formatDate(contract.gps_forecast_date)})`}
                          </span>
                        )}
                        {contract.gpsPaid && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                            <CheckCircle2 size={12}/> GPS Paga {contract.gps_payment_date && `(${formatDate(contract.gps_payment_date)})`}
                          </span>
                        )}
                        {contract.gpsPaid && (contract.gps_value ?? 0) > 0 && (
                          <span className="text-[10px] text-slate-500 ml-1">Valor: {formatCurrency(contract.gps_value ?? 0)}</span>
                        )}
                        {contract.inssDeferred && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full w-fit"><CheckCircle2 size={12}/> Deferido/INSS</span>}
                        {contract.inssProtocol && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                            <AlertCircle size={12}/> Protocolo {contract.inssProtocol}
                          </span>
                        )}
                        {contract.processNumber && <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full w-fit"><FileText size={12}/> Processo {contract.processNumber}</span>}
                        {isEstornado && <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full w-fit"><AlertTriangle size={12}/> Estornado</span>}
                        {isProrrogado && <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full w-fit"><Clock size={12}/> Prorrogado</span>}
                        {!contract.gpsGenerated && !contract.gpsPaid && !contract.inssProtocol && !contract.processNumber && !isEstornado && !isProrrogado && <span className="text-xs text-slate-400">-</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "inline-flex items-center px-3 py-1 rounded text-xs font-medium border border-black/10 shadow-sm",
                        badgeColors
                      )}>
                        {rowStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(contract)}
                          disabled={contract.status === 'Cancelado' || contract.status === 'Quitado'}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            (contract.status === 'Cancelado' || contract.status === 'Quitado')
                              ? "text-slate-300 cursor-not-allowed" 
                              : "text-slate-600 md:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 bg-slate-50 md:bg-transparent"
                          )}
                          title={(contract.status === 'Cancelado' || contract.status === 'Quitado') ? "Contrato cancelado ou quitado não pode ser editado" : "Editar Contrato"}
                        >
                          <Edit2 size={18} />
                        </button>
                        {contract.status !== 'Cancelado' && contract.status !== 'Quitado' && (
                          <button 
                            onClick={(e) => handleCancelClick(e, contract)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Cancelar Contrato"
                          >
                            <Ban size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                  )
                })}
              </tbody>
            </table>
            <div className="md:hidden divide-y divide-slate-100">
              {filteredContracts.map((contract, index) => {
                const nextInstallment = contract.installments
                  ?.filter(i => i.status === 'Aberto' || i.status === 'Atrasada' || i.status === 'Prorrogada' || i.status === 'Estornado')
                  .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
                
                const isQuitado = contract.status === 'Quitado' || (Number(contract.contractValue || 0) > 0 && Number(contract.amountReceived || 0) >= Number(contract.contractValue || 0));
                
                const isEstornado = contract.status?.toLowerCase().trim() === 'estornado' || 
                                   contract.status?.toLowerCase().trim() === 'estornada' ||
                                   contract.installments?.some(i => {
                                     const s = i.status?.toLowerCase().trim();
                                     return s === 'estornado' || s === 'estornada' || s === 'estorno';
                                   });
                
                const isProrrogado = contract.status?.toLowerCase().trim() === 'prorrogado' || 
                                    contract.status?.toLowerCase().trim() === 'prorrogada' ||
                                    contract.installments?.some(i => {
                                      const s = i.status?.toLowerCase().trim();
                                      return s === 'prorrogada' || s === 'prorrogado';
                                    });
                
                let rowStatus = 'Normal';
                if (isEstornado) rowStatus = 'Estornado';
                else if (contract.status === 'Cancelado') rowStatus = 'Cancelado';
                else if (isProrrogado) rowStatus = 'Prorrogado';
                else if (contract.isProBono) rowStatus = 'Pro Bono';
                else if (isQuitado) rowStatus = 'Quitado';
                else if (contract.isFinanced) rowStatus = 'Financiado';

                const rowColors = {
                  'Cancelado': 'bg-[#ea9999]/10 hover:bg-[#ea9999]/20',
                  'Estornado': 'bg-[#f4cccc]/20 hover:bg-[#f4cccc]/30',
                  'Pro Bono': 'bg-[#ffff00]/10 hover:bg-[#ffff00]/20',
                  'Quitado': 'bg-[#b6d7a8]/20 hover:bg-[#b6d7a8]/30',
                  'Prorrogado': 'bg-[#f9cb9c]/20 hover:bg-[#f9cb9c]/30',
                  'Financiado': 'bg-[#46bdc6]/10 hover:bg-[#46bdc6]/20',
                  'Normal': 'bg-[#cfe2f3]/20 hover:bg-[#cfe2f3]/30'
                }[rowStatus];

                const badgeColors = {
                  'Cancelado': 'bg-[#ea9999] text-black line-through',
                  'Estornado': 'bg-[#f4cccc] text-black',
                  'Pro Bono': 'bg-[#ffff00] text-black',
                  'Quitado': 'bg-[#b6d7a8] text-black',
                  'Prorrogado': 'bg-[#f9cb9c] text-black',
                  'Financiado': 'bg-[#46bdc6] text-black',
                  'Normal': 'bg-[#cfe2f3] text-black'
                }[rowStatus];

                return (
                  <div key={contract.id} className={cn("p-4 space-y-3", rowColors)}>
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-slate-900">{contract.clients?.name || 'Cliente não vinculado'}</div>
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium", badgeColors)}>
                        {rowStatus}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">
                      <span className="font-medium text-slate-500">Produto:</span> {products.find(p => p.id === contract.product_id)?.name || 'Produto não vinculado'}
                    </div>
                    <div className="text-sm text-slate-600">
                      <span className="font-medium text-slate-500">Data:</span> {formatDate(contract.launchDate)}
                    </div>
                    <div className="text-sm text-slate-700 font-medium">
                      <span className="font-medium text-slate-500">Valor:</span> {isVisible('finance_table_value') ? formatCurrency(contract.contractValue) : 'R$ •••••'}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button 
                          onClick={() => handleOpenModal(contract)} 
                          disabled={contract.status === 'Cancelado' || contract.status === 'Quitado'}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            (contract.status === 'Cancelado' || contract.status === 'Quitado')
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          Editar
                        </button>
                        {contract.status !== 'Cancelado' && contract.status !== 'Quitado' && (
                          <button 
                            onClick={(e) => handleCancelClick(e, contract)} 
                            className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-medium hover:bg-rose-100"
                          >
                            Cancelar
                          </button>
                        )}
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
          {filteredContracts.length === 0 && (
            <div className="p-12 text-center">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="text-slate-400" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Nenhum contrato encontrado</h3>
              <p className="text-slate-500 mt-1">Crie um novo contrato para começar a gerenciar.</p>
            </div>
          )}
        </div>

        <Modal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          title="Baixa de Título / Liquidação"
          className="z-[60]"
        >
          <div className="space-y-6">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex gap-3">
              <DollarSign className="text-indigo-600 mt-0.5 shrink-0" size={20} />
              <div>
                <p className="text-sm text-indigo-900 font-medium">
                  Parcela {paymentData.index !== null && installments[paymentData.index] ? installments[paymentData.index].installmentNumber : ''}
                </p>
                <p className="text-xs text-indigo-700 mt-1">
                  Valor Total Devido: <strong>{formatCurrency(paymentData.totalDue, true)}</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor Principal Pago (R$)</label>
                <CurrencyInput 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-slate-900"
                  value={paymentData.amount}
                  onChange={(val: number) => setPaymentData({ ...paymentData, amount: val })}
                />
                {paymentData.index !== null && paymentData.amount < (installments[paymentData.index].amount - Number(installments[paymentData.index].amountPaid || 0)) - 0.01 && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">
                    * Será gerada uma nova parcela com a diferença ({formatCurrency((installments[paymentData.index].amount - Number(installments[paymentData.index].amountPaid || 0)) - paymentData.amount, true)})
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data do Pagamento</label>
                <input 
                  type="date"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={paymentData.date}
                  onChange={e => setPaymentData({ ...paymentData, date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Juros (R$)</label>
                <CurrencyInput 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={paymentData.interest}
                  onChange={(val: number) => {
                    const remainingBalance = installments[paymentData.index!].amount - Number(installments[paymentData.index!].amountPaid || 0);
                    setPaymentData({ ...paymentData, interest: val, totalDue: (remainingBalance + val + paymentData.fine) });
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Multa (R$)</label>
                <CurrencyInput 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={paymentData.fine}
                  onChange={(val: number) => {
                    const remainingBalance = installments[paymentData.index!].amount - Number(installments[paymentData.index!].amountPaid || 0);
                    setPaymentData({ ...paymentData, fine: val, totalDue: (remainingBalance + paymentData.interest + val) });
                  }}
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-sm text-slate-700 font-medium flex justify-between items-center">
                <span>Total a ser recebido (Principal + Juros + Multa):</span>
                <strong className="text-indigo-700 text-lg">{formatCurrency(paymentData.amount + paymentData.interest + paymentData.fine, true)}</strong>
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Destino Financeiro (Fluxo de Caixa)</h4>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancária <span className="text-rose-500">*</span></label>
                <select 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={paymentData.account_id}
                  onChange={e => setPaymentData({ ...paymentData, account_id: e.target.value })}
                >
                  <option value="">Selecione uma conta...</option>
                  {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria <span className="text-rose-500">*</span></label>
                <select 
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={paymentData.category_id}
                  onChange={e => setPaymentData({ ...paymentData, category_id: e.target.value })}
                >
                  <option value="">Selecione uma categoria...</option>
                  {financialCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações (Opcional)</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  value={paymentData.observation}
                  onChange={e => setPaymentData({ ...paymentData, observation: e.target.value })}
                  placeholder="Ex: Pago em dinheiro, comprovante X..."
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setPaymentModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmPayment}
                disabled={!paymentData.account_id || !paymentData.category_id || paymentData.amount <= 0}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Baixa
              </button>
            </div>
          </div>
        </Modal>

        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={editingContract ? 'Editar Contrato' : 'Novo Contrato'}
          className="max-w-5xl"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Seção 1: Dados Básicos */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 border-b pb-2">Dados do Contrato</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                  <ClientCombobox 
                    clients={clients}
                    value={formData.client_id || null}
                    onChange={(id) => setFormData({ ...formData, client_id: id })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Produto</label>
                  <select 
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.product_id || ''}
                    onChange={e => handleProductChange(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Selecione um produto...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status do Contrato</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.status || 'Aberto'}
                    onChange={e => {
                      if (e.target.value === 'Cancelado') {
                        const allowedStatuses = ['Aberto', 'Atrasada']
                        const hasNonCancellable = installments.some(i => !allowedStatuses.includes(i.status) || (i.amountPaid || 0) > 0)
                        if (hasNonCancellable) {
                          alert('Não é possível cancelar este contrato pois existem parcelas já recebidas, quitadas, estornadas ou prorrogadas.')
                          return
                        }
                      }
                      setFormData({ ...formData, status: e.target.value })
                    }}
                  >
                    <option value="Aberto">Aberto</option>
                    <option value="Parcial">Parcial</option>
                    <option value="Quitado">Quitado</option>
                    <option value="Cancelado" disabled={installments.some(i => !['Aberto', 'Atrasada'].includes(i.status) || (i.amountPaid || 0) > 0)}>Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data do Lançamento</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.launchDate || ''}
                    onChange={e => setFormData({ ...formData, launchDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data do Contrato</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.contractDate || ''}
                    onChange={e => setFormData({ ...formData, contractDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Área do Direito</label>
                  <input 
                    type="text" 
                    disabled
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 outline-none"
                    value={formData.lawArea || ''}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Número do Processo Judicial</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.processNumber || ''}
                    onChange={e => setFormData({ ...formData, processNumber: formatProcessNumber(e.target.value) })}
                    placeholder="0000000-00.0000.0.00.0000"
                    maxLength={25}
                  />
                </div>
                {formData.product?.toLowerCase().includes('maternidade') && (
                  <div>
                    <label className="block text-sm font-medium text-rose-700 mb-1 flex items-center gap-1">
                      <Calendar size={14} /> Data do Parto <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-4 py-2 border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-rose-50/30"
                      value={formData.childbirthDate || ''}
                      onChange={e => setFormData({ ...formData, childbirthDate: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Advogado Responsável</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                    value={formData.lawyer_id || ''}
                    onChange={e => setFormData({ ...formData, lawyer_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">Selecione um advogado...</option>
                    {lawyers.map(l => (
                      <option key={l.id} value={l.id}>{l.users?.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Seção 2: Financeiro */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b pb-2">
                <h3 className="text-lg font-semibold text-slate-900">Financeiro</h3>
                <div className="flex gap-4">
                  <label className={cn(
                    "flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors",
                    formData.isProBono ? "bg-yellow-50 border-yellow-200" : "border-slate-200"
                  )}>
                    <input 
                      type="checkbox" 
                      disabled={!!formData.isFinanced}
                      className="w-4 h-4 text-yellow-500 rounded border-slate-300 focus:ring-yellow-500 disabled:opacity-50"
                      checked={!!formData.isProBono}
                      onChange={e => {
                        const isProBono = e.target.checked
                        setFormData({ 
                          ...formData, 
                          isProBono, 
                          paymentMethod: isProBono ? 'À Vista' : formData.paymentMethod,
                          commissionPercent: isProBono ? 0 : formData.commissionPercent
                        })
                        if (isProBono) {
                          setInstallments([])
                        }
                      }}
                    />
                    <span className={cn("text-sm font-medium", formData.isFinanced ? 'text-slate-400' : 'text-slate-700')}>Pro Bono</span>
                  </label>
                  <label className={cn(
                    "flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors",
                    formData.isFinanced ? "bg-blue-50 border-blue-200" : "border-slate-200"
                  )}>
                    <input 
                      type="checkbox" 
                      disabled={!!formData.isProBono}
                      className="w-4 h-4 text-blue-500 rounded border-slate-300 focus:ring-blue-500 disabled:opacity-50"
                      checked={!!formData.isFinanced}
                      onChange={e => setFormData({ ...formData, isFinanced: e.target.checked })}
                    />
                    <span className={cn("text-sm font-medium", formData.isProBono ? 'text-slate-400' : 'text-slate-700')}>Financiado</span>
                  </label>
                </div>
              </div>

              <div className="mb-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-blue-600" />
                      Controle de GPS
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded-lg border border-blue-200 shadow-sm hover:bg-blue-50 transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        checked={formData.hasGpsControl || false}
                        onChange={e => setFormData({...formData, hasGpsControl: e.target.checked})}
                      />
                      <span className="text-xs font-bold text-blue-900 uppercase">Habilitar Seção</span>
                    </label>
                  </div>
                  
                  {formData.hasGpsControl && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 pt-2 border-t border-blue-100/50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Previsão GPS</label>
                          <input 
                            type="date" 
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            value={formData.gps_forecast_date || ''}
                            onChange={e => setFormData({...formData, gps_forecast_date: e.target.value})}
                          />
                        </div>
                        
                        <div className="flex items-end pb-2 gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                              checked={formData.gpsGenerated || false}
                              onChange={e => setFormData({...formData, gpsGenerated: e.target.checked})}
                            />
                            <span className="text-sm font-medium text-slate-700">GPS Gerada?</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                              checked={formData.gpsPaid || false}
                              onChange={e => {
                                const isPaid = e.target.checked;
                                setFormData({
                                  ...formData, 
                                  gpsPaid: isPaid,
                                  gps_payment_date: (isPaid && !formData.gps_payment_date) ? new Date().toISOString().split('T')[0] : formData.gps_payment_date
                                });
                              }}
                            />
                            <span className="text-sm font-medium text-slate-700">GPS Paga?</span>
                          </label>
                        </div>
                      </div>

                      {formData.gpsPaid && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-blue-100 animate-in fade-in slide-in-from-top-2">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Data Pagamento GPS</label>
                            <input 
                              type="date" 
                              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                              value={formData.gps_payment_date || ''}
                              onChange={e => setFormData({...formData, gps_payment_date: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Valor GPS</label>
                            <CurrencyInput 
                              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                              value={formData.gps_value || 0}
                              onChange={(val: number) => setFormData({ ...formData, gps_value: val })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor do Contrato</label>
                  <CurrencyInput 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    value={formData.contractValue || 0}
                    onChange={(val: number) => setFormData({ ...formData, contractValue: val })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Base Comissão</label>
                  <CurrencyInput 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.base_comissao || 0}
                    onChange={(val: number) => setFormData({ ...formData, base_comissao: val })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Pagamento</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    value={formData.paymentMethod}
                    onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                  >
                    <option>À Vista</option>
                    <option>À Prazo</option>
                    <option>Parcelado</option>
                  </select>
                </div>
                <div className="flex items-end">
                  {formData.paymentMethod === 'À Vista' && (
                    <button 
                      type="button" 
                      onClick={generateInstallments}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Gerar Parcela Única
                    </button>
                  )}
                  {(formData.paymentMethod === 'Parcelado' || formData.paymentMethod === 'À Prazo') && (
                    <button 
                      type="button" 
                      onClick={generateInstallments}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {formData.paymentMethod === 'À Prazo' ? 'Gerar Vencimento' : 'Gerar Parcelas'}
                    </button>
                  )}
                </div>
              </div>
              
              {(formData.paymentMethod === 'Parcelado' || formData.paymentMethod === 'À Prazo') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {formData.paymentMethod === 'À Prazo' ? 'Vencimento' : 'Qtd. Parcelas (Até 12x)'}
                  </label>
                  {formData.paymentMethod === 'Parcelado' && (
                    <input 
                      type="number" 
                      min="2" max="12"
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      value={formData.installmentsCount || ''}
                      onChange={e => setFormData({ ...formData, installmentsCount: Number(e.target.value) })}
                    />
                  )}
                </div>
              )}

              {/* Grid de Parcelas */}
              {!formData.isProBono && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-slate-900">Cronograma de Parcelas</h4>
                    <span className="text-sm font-medium text-slate-500">{installments.length} parcelas</span>
                  </div>
                  
                  {installments.length > 0 ? (
                    <>
                      {/* Summary Card */}
                  <div className="mb-6">
                    <div className="flex flex-col overflow-hidden rounded-xl shadow-sm bg-white border border-slate-200">
                      <div className="h-32 w-full bg-gradient-to-br from-indigo-600 to-blue-700 relative flex flex-col justify-end p-5">
                        <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Status: {formData.status || 'Aberto'}</p>
                        <div className="overflow-hidden whitespace-nowrap" ref={containerRef}>
                          <AutoResizeText 
                            text={formatCurrency(financialSummary.total, true)}
                            className="text-white text-3xl font-extrabold tracking-tight"
                            containerRef={containerRef}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 p-5">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-sm font-medium">Saldo Remanescente</span>
                          <span className="text-indigo-600 font-bold text-lg">{formatCurrency(financialSummary.saldoRemanescente, true)}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full transition-all" style={{ width: `${Math.min(100, (financialSummary.liquidado / (financialSummary.total || 1)) * 100)}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                          <span>Liquidado: {formatCurrency(financialSummary.liquidado, true)}</span>
                          <span>Total: {installments.length} Parcelas</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 font-semibold text-slate-600">Parcela</th>
                          <th className="px-4 py-3 font-semibold text-slate-600">Vencimento</th>
                          <th className="px-4 py-3 font-semibold text-slate-600">Valor Original</th>
                          <th className="px-4 py-3 font-semibold text-slate-600">Saldo Devedor</th>
                          <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.map((inst, idx) => {
                              const saldoDevedor = Math.max(0, inst.amount - Number(inst.amountPaid || 0));
                              
                              let displayStatus = inst.status;
                              if (inst.status !== 'Quitado' && inst.status !== 'Cancelado' && inst.status !== 'Estornado' && inst.original_due_date && inst.dueDate !== inst.original_due_date) {
                                if (new Date(inst.dueDate) > new Date(inst.original_due_date)) displayStatus = 'Prorrogado';
                                else if (new Date(inst.dueDate) < new Date(inst.original_due_date)) displayStatus = 'Antecipado';
                              }

                              return (
                                <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3 font-medium text-slate-900">
                                    {inst.installmentNumber}/{installments.length}
                                  </td>
                                  <td className="px-4 py-3">
                                    <input 
                                      type="date" 
                                      className="text-xs font-medium px-2 py-1 border border-transparent hover:border-slate-200 rounded bg-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                                      value={inst.dueDate} 
                                      onChange={e => updateInstallment(idx, 'dueDate', e.target.value)} 
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <CurrencyInput 
                                      value={inst.amount} 
                                      onChange={(val: number) => updateInstallment(idx, 'amount', val)} 
                                      className="w-24 text-sm bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none" 
                                    />
                                  </td>
                                  <td className="px-4 py-3 font-semibold text-slate-900">
                                    {formatCurrency(saldoDevedor, true)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={cn(
                                      "inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                      displayStatus === 'Quitado' ? "bg-emerald-100 text-emerald-700" :
                                      displayStatus === 'Parcial' ? "bg-indigo-100 text-indigo-700" :
                                      displayStatus === 'Atrasada' ? "bg-rose-100 text-rose-700" :
                                      displayStatus === 'Prorrogado' ? "bg-amber-100 text-amber-700" :
                                      displayStatus === 'Antecipado' ? "bg-blue-100 text-blue-700" :
                                      displayStatus === 'Estornado' ? "bg-red-600 text-white shadow-sm" :
                                      displayStatus === 'Cancelado' ? "bg-slate-100 text-slate-600" :
                                      "bg-slate-100 text-slate-600"
                                    )}>
                                      {displayStatus}
                                    </span>
                                  </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {inst.status === 'Cancelado' ? (
                                    <button type="button" onClick={() => updateInstallment(idx, 'status', 'Aberto')} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Reabrir">
                                      <History size={16} />
                                    </button>
                                  ) : (
                                    <>
                                      {/* Cancelar Button: Disabled if not Aberto or Atrasada */}
                                      <button 
                                        type="button" 
                                        onClick={() => updateInstallment(idx, 'status', 'Cancelado')} 
                                        disabled={!['Aberto', 'Atrasada'].includes(inst.status)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:bg-transparent" 
                                        title="Cancelar"
                                      >
                                        <Ban size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  Nenhuma parcela gerada. Clique em &quot;Gerar Vencimento&quot; para criar o cronograma.
                </div>
              )}

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredContracts.map((contract, index) => {
                  const nextInstallment = contract.installments
                    ?.filter(i => i.status === 'Aberto' || i.status === 'Atrasada' || i.status === 'Prorrogada' || i.status === 'Estornado')
                    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
                  
                  const isQuitado = contract.status === 'Quitado' || (Number(contract.contractValue || 0) > 0 && Number(contract.amountReceived || 0) >= Number(contract.contractValue || 0));
                  
                  const isEstornado = contract.status?.toLowerCase().trim() === 'estornado' || 
                                     contract.status?.toLowerCase().trim() === 'estornada' ||
                                     contract.installments?.some(i => {
                                       const s = i.status?.toLowerCase().trim();
                                       return s === 'estornado' || s === 'estornada' || s === 'estorno';
                                     });
                  
                  const isProrrogado = contract.status?.toLowerCase().trim() === 'prorrogado' || 
                                      contract.status?.toLowerCase().trim() === 'prorrogada' ||
                                      contract.installments?.some(i => {
                                        const s = i.status?.toLowerCase().trim();
                                        return s === 'prorrogada' || s === 'prorrogado';
                                      });
                  
                  let rowStatus = 'Normal';
                  if (isEstornado) rowStatus = 'Estornado';
                  else if (contract.status === 'Cancelado') rowStatus = 'Cancelado';
                  else if (isProrrogado) rowStatus = 'Prorrogado';
                  else if (contract.isProBono) rowStatus = 'Pro Bono';
                  else if (isQuitado) rowStatus = 'Quitado';
                  else if (contract.isFinanced) rowStatus = 'Financiado';

                  const badgeColors = {
                    'Cancelado': 'bg-[#ea9999] text-black line-through',
                    'Estornado': 'bg-[#f4cccc] text-black',
                    'Pro Bono': 'bg-[#ffff00] text-black',
                    'Quitado': 'bg-[#b6d7a8] text-black',
                    'Prorrogado': 'bg-[#f9cb9c] text-black',
                    'Financiado': 'bg-[#46bdc6] text-black',
                    'Normal': 'bg-[#cfe2f3] text-black'
                  }[rowStatus];

                  return (
                    <div key={contract.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="font-semibold text-slate-900">{contract.clients?.name}</div>
                        <span className={cn("px-2 py-1 rounded-full text-xs font-semibold", badgeColors)}>
                          {rowStatus}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        <span className="font-medium text-slate-500">Produto:</span> {contract.products?.name || 'N/A'}
                      </div>
                      <div className="text-sm text-slate-700 font-medium">
                        <span className="font-medium text-slate-500">Valor:</span> {formatCurrency(Number(contract.contractValue || 0), isVisible('finance_table_value'))}
                      </div>
                      <div className="text-sm text-slate-600">
                        <span className="font-medium text-slate-500">Próx. Vencimento:</span> {nextInstallment ? formatDate(nextInstallment.dueDate) : 'N/A'}
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button 
                          onClick={() => handleOpenModal(contract)}
                          className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100"
                        >
                          Detalhes
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

            {/* Seção 3: Checklist INSS e Documentos */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 border-b pb-2">Checklist & INSS</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.contractSigned} onChange={e => setFormData({...formData, contractSigned: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Contrato Assinado?</span>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.proxySigned} onChange={e => setFormData({...formData, proxySigned: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Procuração Assinada?</span>
                </label>
                {formData.product?.toLowerCase().includes('maternidade') && (
                  <></>
                )}
                <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={formData.inssDeferred} onChange={e => setFormData({...formData, inssDeferred: e.target.checked})} />
                  <span className="text-sm font-medium text-slate-700">Deferimento INSS?</span>
                </label>
                <div>
                  <input 
                    type="text" 
                    placeholder="Requerimento/Protocolo INSS"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.inssProtocol || ''}
                    onChange={e => setFormData({ ...formData, inssProtocol: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Seção 4: Indicador e Comissões */}
            {!formData.isProBono && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 border-b pb-2">Indicador & Comissões</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Indicador</label>
                    <select 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      value={formData.indicator_id || ''}
                      onChange={e => setFormData({ ...formData, indicator_id: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">Nenhum</option>
                      {indicators.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">% Comissão</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      value={formData.commissionPercent || ''}
                      onChange={e => setFormData({ ...formData, commissionPercent: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor da Comissão</label>
                    <CurrencyInput 
                      disabled
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 outline-none"
                      value={calculatedCommission}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
              <textarea 
                rows={3}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                value={formData.observations || ''}
                onChange={e => setFormData({ ...formData, observations: e.target.value })}
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
                {editingContract ? 'Salvar Alterações' : 'Criar Contrato'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
      {/* Estorno Modal */}
      {estornoModalOpen && estornoIndex !== null && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-sm p-4 sm:p-0 sm:items-center sm:justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col w-full max-w-lg">
            <button className="flex h-6 w-full items-center justify-center pt-2 sm:hidden" onClick={() => setEstornoModalOpen(false)}>
              <div className="h-1.5 w-12 rounded-full bg-slate-200"></div>
            </button>
            <div className="flex-1 overflow-y-auto px-6 pb-8 pt-4 sm:pt-8">
              <header className="text-center border-b border-slate-100 mb-6 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Confirmar Estorno</h2>
                <p className="text-sm text-slate-500">Ação irreversível de estorno financeiro</p>
              </header>

              <div className="mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <FileText size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Vencimento: {formatDate(installments[estornoIndex].dueDate)}
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {formatCurrency(installments[estornoIndex].amountPaid || 0, true)}
                    </p>
                    <p className="text-sm text-slate-500 font-medium italic">
                      Parcela {installments[estornoIndex].installmentNumber}/{installments.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-orange-100 flex gap-3">
                <AlertTriangle className="text-orange-600 mt-0.5 shrink-0" size={20} />
                <p className="text-sm text-orange-800 leading-relaxed">
                  Esta ação irá <strong>restaurar o saldo</strong> ao título original. O pagamento será marcado como aberto.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Motivo do Estorno</label>
                  <select 
                    className="w-full h-14 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    value={estornoReason}
                    onChange={(e) => setEstornoReason(e.target.value)}
                  >
                    <option disabled value="">Selecione um motivo...</option>
                    <option value="Lançamento Duplicado">Lançamento Duplicado</option>
                    <option value="Solicitação do Cliente">Solicitação do Cliente</option>
                    <option value="Erro de Digitação/Processamento">Erro de Digitação/Processamento</option>
                    <option value="Outro Motivo">Outro Motivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Observações adicionais (Opcional)</label>
                  <textarea 
                    className="w-full p-4 rounded-xl border border-slate-200 bg-white text-slate-900 min-h-[120px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none" 
                    placeholder="Descreva o motivo detalhadamente..."
                    value={estornoObs}
                    onChange={(e) => setEstornoObs(e.target.value)}
                  ></textarea>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button 
                  onClick={handleConfirmEstorno}
                  disabled={!estornoReason}
                  className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-lg shadow-lg shadow-red-200 transition-colors flex items-center justify-center gap-2"
                >
                  <History size={20} />
                  Confirmar Estorno
                </button>
                <button 
                  onClick={() => setEstornoModalOpen(false)}
                  className="w-full py-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Cancel Contract Modal */}
      {cancelModalOpen && contractToCancel && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-sm p-4 sm:p-0 sm:items-center sm:justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col w-full max-w-lg">
            <button className="flex h-6 w-full items-center justify-center pt-2 sm:hidden" onClick={() => setCancelModalOpen(false)}>
              <div className="h-1.5 w-12 rounded-full bg-slate-200"></div>
            </button>
            <div className="flex-1 overflow-y-auto px-6 pb-8 pt-4 sm:pt-8">
              <header className="text-center border-b border-slate-100 mb-6 pb-4">
                <div className="mx-auto w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
                  <Ban size={24} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Cancelar Contrato</h2>
                <p className="text-sm text-slate-500 mt-1">Esta ação cancelará o contrato e todas as suas parcelas em aberto.</p>
              </header>

              <div className="space-y-5">
                {cancelError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium flex items-start gap-2">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p>{cancelError}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Motivo do Cancelamento <span className="text-rose-500">*</span></label>
                  <textarea 
                    className="w-full p-4 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all resize-none h-32"
                    placeholder="Descreva detalhadamente o motivo do cancelamento..."
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Confirmação de Segurança <span className="text-rose-500">*</span></label>
                  <p className="text-xs text-slate-500 mb-2">Digite <strong>CANCELAR</strong> no campo abaixo para confirmar a operação.</p>
                  <input 
                    type="text" 
                    className="w-full p-4 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all font-mono uppercase"
                    placeholder="CANCELAR"
                    value={cancelConfirmation}
                    onChange={e => setCancelConfirmation(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <button 
                  onClick={executeCancelContract}
                  className="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Ban size={20} />
                  Confirmar Cancelamento
                </button>
                <button 
                  onClick={() => setCancelModalOpen(false)}
                  className="w-full py-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

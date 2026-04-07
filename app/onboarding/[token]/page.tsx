'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getAppEnv } from '@/lib/env'
import { Loader2, CheckCircle2, AlertTriangle, User, Mail, Phone, MapPin, FileText } from 'lucide-react'
import { validateCPF, validateCNPJ, formatCPF, formatCNPJ, formatCEP, formatPhone, cn } from '@/lib/utils'
import { motion } from 'motion/react'

export default function OnboardingPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [clientData, setClientData] = useState<any>(null)
  const [tokenId, setTokenId] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'Pessoa Física',
    document: '',
    address: '',
    addressNumber: '',
    addressComplement: '',
    neighborhood: '',
    city: '',
    uf: '',
    cep: '',
    civilStatus: 'Solteiro(a)',
    profession: '',
    birthDate: '',
    lgpd_consent: false
  })

  const [formErrors, setFormErrors] = useState<{ document?: string; cep?: string; lgpd?: string }>({})

  useEffect(() => {
    const fetchTokenAndClient = async () => {
      if (!token) return

      try {
        // Find token
        const { data: tokenData, error: tokenError } = await supabase
          .from('client_onboarding_tokens')
          .select('id, client_id, used, expires_at, environment')
          .eq('token', token)
          .single()

        if (tokenError || !tokenData) {
          setError('Link inválido ou não encontrado.')
          setIsLoading(false)
          return
        }

        // Check if environment matches
        const currentEnv = getAppEnv();
        if (tokenData.environment && tokenData.environment !== currentEnv) {
          console.log(`[Onboarding] Switching environment from ${currentEnv} to ${tokenData.environment}`);
          document.cookie = `app_env=${tokenData.environment}; path=/; max-age=31536000`;
          window.location.reload();
          return;
        }

        if (tokenData.used) {
          setError('Este link já foi utilizado.')
          setIsLoading(false)
          return
        }

        const now = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z';
        if (tokenData.expires_at < now) {
          setError('Este link expirou. Solicite um novo link ao seu advogado.')
          setIsLoading(false)
          return
        }

        setTokenId(tokenData.id)

        // Fetch client data
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', tokenData.client_id)
          .single()

        if (clientError || !client) {
          setError('Cliente não encontrado.')
          setIsLoading(false)
          return
        }

        setClientData(client)
        setFormData({
          name: client.name || '',
          email: client.email || '',
          phone: client.phone || '',
          type: client.type || 'Pessoa Física',
          document: client.document || '',
          address: client.address || '',
          addressNumber: client.addressNumber || '',
          addressComplement: client.addressComplement || '',
          neighborhood: client.neighborhood || '',
          city: client.city || '',
          uf: client.uf || '',
          cep: client.cep || '',
          civilStatus: client.civilStatus || 'Solteiro(a)',
          profession: client.profession || '',
          birthDate: client.birthDate || '',
          lgpd_consent: client.lgpd_consent || false
        })

      } catch (err) {
        console.error('Error fetching onboarding data:', err)
        setError('Ocorreu um erro ao carregar os dados.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTokenAndClient()
  }, [token])

  const handleDocumentChange = (value: string) => {
    const formatted = formData.type === 'Pessoa Física' ? formatCPF(value) : formatCNPJ(value)
    setFormData({ ...formData, document: formatted })
    setFormErrors({ ...formErrors, document: undefined })
  }

  const handleCEPChange = async (value: string) => {
    const formatted = formatCEP(value)
    setFormData(prev => ({ ...prev, cep: formatted }))
    
    const cleanCEP = formatted.replace(/\D/g, '')
    if (cleanCEP.length === 8) {
      setFormErrors(prev => ({ ...prev, cep: undefined }))
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)
        const data = await response.json()
        
        if (data.erro) {
          setFormErrors(prev => ({ ...prev, cep: 'CEP não encontrado.' }))
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
        setFormErrors(prev => ({ ...prev, cep: 'Erro ao buscar CEP.' }))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.lgpd_consent) {
      setFormErrors({ ...formErrors, lgpd: 'Você precisa aceitar os termos de uso e política de privacidade.' })
      return
    }

    const isCPF = formData.type === 'Pessoa Física'
    const isDocumentValid = isCPF ? validateCPF(formData.document) : validateCNPJ(formData.document)
    
    if (!isDocumentValid) {
      setFormErrors({ ...formErrors, document: `Documento (${isCPF ? 'CPF' : 'CNPJ'}) inválido.` })
      return
    }

    setIsSubmitting(true)

    try {
      // Update client
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          ...formData,
          lgpd_consent_date: new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z',
          lgpd_source: 'Digital Onboarding'
        })
        .eq('id', clientData.id)

      if (updateError) throw updateError

      // Mark token as used
      const { error: tokenError } = await supabase
        .from('client_onboarding_tokens')
        .update({ 
          used: true,
          used_at: new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '.000Z'
        })
        .eq('id', tokenId)

      if (tokenError) throw tokenError

      setSuccess(true)
    } catch (err) {
      console.error('Error submitting onboarding:', err)
      alert('Ocorreu um erro ao salvar seus dados. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
          <p>Carregando formulário...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Acesso Inválido</h1>
          <p className="text-slate-600 mb-6">{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center"
        >
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Cadastro Concluído!</h1>
          <p className="text-slate-600 mb-6">
            Seus dados foram atualizados com sucesso. Agradecemos a colaboração.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Atualização Cadastral</h1>
          <p className="mt-2 text-slate-600">Por favor, preencha ou confirme seus dados abaixo.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
            
            {/* Dados Pessoais */}
            <section>
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">
                <User className="text-indigo-600" size={20} />
                Dados Pessoais
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Pessoa</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value, document: '' })}
                  >
                    <option>Pessoa Física</option>
                    <option>Pessoa Jurídica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {formData.type === 'Pessoa Física' ? 'CPF' : 'CNPJ'}
                  </label>
                  <input 
                    required
                    type="text" 
                    className={cn(
                      "w-full px-4 py-2 border rounded-xl focus:ring-2 outline-none transition-all",
                      formErrors.document ? "border-rose-500 focus:ring-rose-500/20" : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500"
                    )}
                    value={formData.document}
                    onChange={e => handleDocumentChange(e.target.value)}
                    placeholder={formData.type === 'Pessoa Física' ? '000.000.000-00' : '00.000.000/0000-00'}
                  />
                  {formErrors.document && <p className="text-xs text-rose-500 mt-1">{formErrors.document}</p>}
                </div>
                {formData.type === 'Pessoa Física' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento</label>
                      <input 
                        type="date" 
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        value={formData.birthDate}
                        onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                      />
                    </div>
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
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Profissão</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        value={formData.profession}
                        onChange={e => setFormData({ ...formData, profession: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Contato */}
            <section>
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">
                <Phone className="text-indigo-600" size={20} />
                Contato
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                  <input 
                    type="email" 
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </section>

            {/* Endereço */}
            <section>
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100">
                <MapPin className="text-indigo-600" size={20} />
                Endereço
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                  <input 
                    type="text" 
                    className={cn(
                      "w-full px-4 py-2 border rounded-xl focus:ring-2 outline-none transition-all",
                      formErrors.cep ? "border-rose-500 focus:ring-rose-500/20" : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500"
                    )}
                    value={formData.cep}
                    onChange={e => handleCEPChange(e.target.value)}
                    placeholder="00000-000"
                  />
                  {formErrors.cep && <p className="text-xs text-rose-500 mt-1">{formErrors.cep}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Logradouro</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.addressNumber}
                    onChange={e => setFormData({ ...formData, addressNumber: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Complemento</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.addressComplement}
                    onChange={e => setFormData({ ...formData, addressComplement: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bairro</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.neighborhood}
                    onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">UF</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.uf}
                    onChange={e => setFormData({ ...formData, uf: e.target.value })}
                    maxLength={2}
                  />
                </div>
              </div>
            </section>

            {/* Termos e Consentimento */}
            <section className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <div className="flex items-start gap-3">
                <div className="flex items-center h-5 mt-1">
                  <input
                    id="lgpd_consent"
                    type="checkbox"
                    className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    checked={formData.lgpd_consent}
                    onChange={e => {
                      setFormData({ ...formData, lgpd_consent: e.target.checked })
                      if (e.target.checked) setFormErrors({ ...formErrors, lgpd: undefined })
                    }}
                  />
                </div>
                <div className="text-sm">
                  <label htmlFor="lgpd_consent" className="font-medium text-slate-900 cursor-pointer">
                    Consentimento de Tratamento de Dados (LGPD)
                  </label>
                  <p className="text-slate-500 mt-1">
                    Autorizo o escritório a coletar, armazenar e tratar meus dados pessoais informados neste formulário, 
                    com a finalidade exclusiva de prestação de serviços jurídicos, elaboração de contratos e procurações, 
                    conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                  </p>
                  {formErrors.lgpd && <p className="text-rose-500 mt-2 font-medium">{formErrors.lgpd}</p>}
                </div>
              </div>
            </section>

            <div className="pt-6 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Salvando dados...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    Confirmar e Salvar Dados
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

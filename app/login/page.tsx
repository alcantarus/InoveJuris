'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { Scale, Lock, Mail, AlertCircle, AlertTriangle, ChevronRight, CheckCircle2, Globe, Beaker } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { AppEnv } from '@/lib/env'
import { cn } from '@/lib/utils'

import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Carregando...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}
function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loginStep, setLoginStep] = useState<'credentials' | 'environment'>('credentials')
  const [validatedUser, setValidatedUser] = useState<any>(null)
  const [selectedEnv, setSelectedEnv] = useState<AppEnv>('production')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { validateCredentials, login } = useAuth()

  useEffect(() => {
    if (searchParams.get('reason') === 'timeout') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInfoMessage('Sua sessão expirou por inatividade. Por favor, faça login novamente.')
    }
  }, [searchParams])

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfoMessage('')
    setIsLoading(true)

    const result = await validateCredentials(email, password)
    
    if (result.success) {
      const user = result.user
      // Robust check for permissions
      const canProd = user.canAccessProdEnv === true || user.canAccessProdEnv === null || user.canAccessProdEnv === undefined;
      const canTest = user.canAccessTestEnv === true;

      console.log('[Login] Permissões detectadas:', { canProd, canTest, raw: { prod: user.canAccessProdEnv, test: user.canAccessTestEnv } });

      setValidatedUser(user)

      if (canProd && canTest) {
        // Both - Explicitly set step to environment
        console.log('[Login] Ambos os ambientes disponíveis. Mostrando seleção.');
        setLoginStep('environment')
        setIsLoading(false)
      } else if (canProd) {
        // Only Prod
        console.log('[Login] Apenas Produção disponível. Entrando automaticamente.');
        const loginResult = await login(user, 'production')
        if (!loginResult.success) {
          setError(loginResult.error || 'Erro ao acessar ambiente de produção.')
          setIsLoading(false)
        }
      } else if (canTest) {
        // Only Test
        console.log('[Login] Apenas Testes disponível. Entrando automaticamente.');
        const loginResult = await login(user, 'test')
        if (!loginResult.success) {
          setError(loginResult.error || 'Erro ao acessar ambiente de testes.')
          setIsLoading(false)
        }
      } else {
        // None
        setError('Você não tem permissão para acessar nenhum ambiente.')
        setIsLoading(false)
      }
    } else {
      setError(result.error || 'Erro ao fazer login.')
      setIsLoading(false)
    }
  }

  const handleFinalLogin = async () => {
    setError('')
    setIsLoading(true)

    const result = await login(validatedUser, selectedEnv)
    
    if (result.success) {
      // router.push('/') is handled by window.location.href in auth.ts
    } else {
      setError(result.error || 'Erro ao selecionar ambiente.')
      setIsLoading(false)
    }
  }

  // ... dentro do JSX, nos botões de seleção:
  // onClick={() => { console.log('[Login] Ambiente selecionado:', 'production'); setSelectedEnv('production')}}
  // onClick={() => { console.log('[Login] Ambiente selecionado:', 'test'); setSelectedEnv('test')}}


  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="p-8 sm:p-10">
            <div className="flex justify-center mb-6">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500",
                loginStep === 'credentials' 
                  ? "bg-indigo-600 shadow-indigo-600/20" 
                  : (selectedEnv === 'production' ? "bg-emerald-600 shadow-emerald-600/20" : "bg-amber-500 shadow-amber-500/20")
              )}>
                <Scale className="text-white" size={32} />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">
              {loginStep === 'credentials' ? 'Bem-vindo ao InoveJuris' : 'Selecione o Ambiente'}
            </h2>
            
            <p className="text-center text-slate-500 mb-8">
              {loginStep === 'credentials' 
                ? 'Faça login para acessar o sistema' 
                : `Olá, ${validatedUser?.name}. Em qual ambiente deseja trabalhar?`}
            </p>

            {infoMessage && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-700"
              >
                <AlertTriangle className="shrink-0" size={20} />
                <p className="text-sm font-medium">{infoMessage}</p>
              </motion.div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700"
              >
                <AlertCircle className="shrink-0" size={20} />
                <p className="text-sm font-medium">{error}</p>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {loginStep === 'credentials' ? (
                <motion.form 
                  key="step-credentials"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleValidate} 
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      E-mail
                    </label>
                    <div className="relative" suppressHydrationWarning>
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="email"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="password"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Validando...' : (
                      <>
                        Continuar
                        <ChevronRight size={18} />
                      </>
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.div 
                  key="step-environment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-3">
                    {validatedUser?.canAccessProdEnv !== false && (
                      <button
                        onClick={() => setSelectedEnv('production')}
                        className={cn(
                          "p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4",
                          selectedEnv === 'production' 
                            ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20" 
                            : "border-slate-100 bg-slate-50 hover:border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          selectedEnv === 'production' ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
                        )}>
                          <Globe size={20} />
                        </div>
                        <div className="flex-1">
                          <p className={cn("font-bold text-sm", selectedEnv === 'production' ? "text-emerald-700" : "text-slate-700")}>
                            Ambiente de Produção
                          </p>
                          <p className="text-xs text-slate-500">Dados reais e oficiais</p>
                        </div>
                        {selectedEnv === 'production' && <CheckCircle2 className="text-emerald-600" size={20} />}
                      </button>
                    )}

                    {validatedUser?.canAccessTestEnv === true && (
                      <button
                        onClick={() => setSelectedEnv('test')}
                        className={cn(
                          "p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4",
                          selectedEnv === 'test' 
                            ? "border-amber-500 bg-amber-50 ring-2 ring-amber-500/20" 
                            : "border-slate-100 bg-slate-50 hover:border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          selectedEnv === 'test' ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"
                        )}>
                          <Beaker size={20} />
                        </div>
                        <div className="flex-1">
                          <p className={cn("font-bold text-sm", selectedEnv === 'test' ? "text-amber-700" : "text-slate-700")}>
                            Ambiente de Testes
                          </p>
                          <p className="text-xs text-slate-500">Homologação e treinamento</p>
                        </div>
                        {selectedEnv === 'test' && <CheckCircle2 className="text-amber-500" size={20} />}
                      </button>
                    )}
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      onClick={() => setLoginStep('credentials')}
                      className="flex-1 py-3 px-4 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-all"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleFinalLogin}
                      disabled={isLoading}
                      className={cn(
                        "flex-[2] py-3 px-4 text-white rounded-xl font-semibold transition-all disabled:opacity-70 flex items-center justify-center gap-2",
                        selectedEnv === 'production' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-500 hover:bg-amber-600"
                      )}
                    >
                      {isLoading ? 'Entrando...' : 'Confirmar e Entrar'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="bg-slate-50 p-6 text-center border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Acesso restrito a usuários autorizados.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

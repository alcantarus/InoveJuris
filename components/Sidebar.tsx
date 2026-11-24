'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSettings } from '@/components/providers/SettingsProvider'
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  DollarSign, 
  Settings, 
  LogOut,
  Scale,
  Menu,
  X,
  UserCog,
  Package,
  Shield,
  BarChart3,
  Wallet,
  Info,
  Bell,
  Gavel,
  ShieldCheck,
  TrendingUp,
  Briefcase,
  MessageSquare,
  CalendarClock,
  CalendarDays,
  Newspaper,
  BadgeCheck,
  Sparkles,
  Copy,
  Check,
  MessageCircle,
  MapPin,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { getAppEnv, getIsProduction, getEnvName, AppEnv } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { Beaker, Globe } from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(true)
  const [isMobileOpen, setIsMobileOpen] = React.useState(false)
  const [isAboutOpen, setIsAboutOpen] = React.useState(false)
  const [copiedPhone, setCopiedPhone] = React.useState(false)
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const { user, logout, switchEnvironment } = useAuth()
  const { settings } = useSettings()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isSwitchingEnv, setIsSwitchingEnv] = useState(false)

  const isProduction = getIsProduction()
  const envName = getEnvName()

  const supportPhone = '(77) 9 9991-0345'
  const supportPhoneHref = 'https://wa.me/5577999910345'

  useEffect(() => {
    if (!isAboutOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAboutOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAboutOpen])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(supportPhone)
      setCopiedPhone(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopiedPhone(false), 2000)
    } catch {
      window.open('tel:+5577999910345', '_self')
    }
  }

  const aboutFeatures = [
    {
      icon: Scale,
      title: 'Processos',
      description: 'Prazos, publicações e andamentos sob controle.',
      tone: 'bg-indigo-50 text-indigo-600',
    },
    {
      icon: Wallet,
      title: 'Financeiro',
      description: 'Receitas, despesas e recebíveis em tempo real.',
      tone: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: Users,
      title: 'Clientes',
      description: 'Cadastro, documentos e relacionamento ágil.',
      tone: 'bg-sky-50 text-sky-600',
    },
  ]

  const handleSwitchEnv = async (targetEnv: AppEnv) => {
    if (targetEnv === getAppEnv()) return;
    setIsSwitchingEnv(true);
    const result = await switchEnvironment(targetEnv);
    if (!result.success) {
      alert(result.error);
      setIsSwitchingEnv(false);
    }
  };

  const fetchUnreadCount = React.useCallback(async () => {
    if (!user?.id) return
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('user_id', user.id)
    
    if (!error) setUnreadCount(count || 0)
  }, [user])

  useEffect(() => {
    if (!user?.id) return

    const initialize = async () => {
      await fetchUnreadCount()
    }
    initialize()
    
    // Subscribe to changes
    const channel = supabase
      .channel('notifications-count')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchUnreadCount()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchUnreadCount])

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, show: user?.canAccessDashboard, group: 'Gestão Jurídica' },
    { name: 'Clientes', href: '/clientes', icon: Users, show: user?.canAccessClients, group: 'Gestão Jurídica' },
    { name: 'Advogados', href: '/advogados', icon: UserCog, show: user?.canAccessLawyers, group: 'Gestão Jurídica' },
    { name: 'Processos', href: '/processos', icon: Gavel, show: user?.canAccessProcesses, group: 'Gestão Jurídica' },
    { name: 'Documentos', href: '/documentos', icon: FileText, show: user?.canAccessDocuments, group: 'Gestão Jurídica' },
    { name: 'Contratos', href: '/contratos', icon: Briefcase, show: user?.canAccessContracts, group: 'Controladoria' },
    { name: 'Contas a Receber', href: '/contas-a-receber', icon: Wallet, show: user?.canAccessReceivables, group: 'Controladoria' },
    { name: 'Fluxo de Caixa', href: '/fluxo-caixa', icon: TrendingUp, show: user?.canAccessCashFlow, group: 'Controladoria' },
    { name: 'Prazos', href: '/prazos', icon: CalendarClock, show: user?.canAccessPrazos, group: 'Operacional' },
    { name: 'Calendário', href: '/calendario', icon: CalendarDays, show: user?.canAccessCalendario, group: 'Operacional' },
    { name: 'Publicações', href: '/publicacoes', icon: Newspaper, show: user?.canAccessPublicacoes, group: 'Operacional' },
    { name: 'Notificações', href: '/notificacoes', icon: Bell, show: true, group: 'Operacional' },
    { name: 'Produtos', href: '/produtos', icon: Package, show: user?.canAccessProducts, group: 'Operacional' },
    { name: 'Indicadores', href: '/indicadores', icon: BarChart3, show: user?.canAccessIndicators, group: 'Operacional' },
    { name: 'Gestão de Leads', href: '/leads', icon: MessageSquare, show: user?.canAccessLeads, group: 'Operacional' },
    { name: 'Relatórios', href: '/relatorios', icon: FileText, show: user?.canAccessReports, group: 'Relatórios' },
    { name: 'Auditoria', href: '/auditoria', icon: ShieldCheck, show: user?.canAccessAudit, group: 'Administrativo' },
    { name: 'Usuários', href: '/usuarios', icon: Users, show: user?.canAccessUsers, group: 'Administrativo' },
    { name: 'Configurações', href: '/configuracoes', icon: Settings, show: user?.canAccessSettings, group: 'Administrativo' },
  ].filter(item => item.show)

  const groupedNavItems = navItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <>
      {/* Mobile Header */}
      <div className={cn(
        "lg:hidden fixed top-8 left-0 right-0 h-16 border-b z-50 flex items-center px-4 justify-between transition-colors",
        isProduction ? "bg-white border-slate-200" : "bg-amber-50 border-amber-200"
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-lg text-white",
            isProduction ? "bg-indigo-600" : "bg-brand"
          )}>
            <Scale size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-slate-800 leading-none">InoveJuris</span>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-tighter mt-0.5",
              isProduction ? "text-indigo-600" : "text-amber-600"
            )}>
              {envName}
            </span>
          </div>
        </div>
        <button 
          className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <aside className={cn(
        "fixed left-0 bottom-0 bg-white border-r border-slate-200 z-40 transition-all duration-300 ease-in-out",
        "top-24 lg:top-6",
        isOpen ? "w-64" : "w-20",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className="hidden lg:flex p-3 items-center gap-3 border-b border-slate-100 shrink-0">
            <div className={cn(
              "p-1.5 rounded-lg text-white transition-colors",
              isProduction ? "bg-indigo-600" : "bg-brand"
            )}>
              <Briefcase size={18} />
            </div>
            {isOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col"
              >
                <span className="font-bold text-base tracking-tight text-slate-800 leading-none">InoveJuris</span>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-tighter mt-0.5",
                  isProduction ? "text-indigo-600" : "text-amber-600"
                )}>
                  {envName}
                </span>
              </motion.div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto custom-scrollbar">
            {Object.entries(groupedNavItems).map(([group, items]) => (
              <div key={group}>
                {isOpen && (
                  <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 px-2">
                    {group}
                  </h3>
                )}
                <div className="space-y-0">
                  {items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link 
                        key={item.name} 
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          (item as any).isChild ? "flex items-center gap-2 pl-8 pr-2 py-1 rounded-lg transition-all duration-200 group text-xs" : "flex items-center gap-2 px-2 py-1 rounded-lg transition-all duration-200 group text-xs",
                          isActive 
                            ? "bg-indigo-50 text-indigo-600 font-medium" 
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}
                      >
                        <item.icon size={14} className={cn(
                          "shrink-0",
                          isActive ? "text-indigo-600" : "text-slate-500 group-hover:text-slate-600"
                        )} />
                        {isOpen && <span>{item.name}</span>}
                        {item.name === 'Notificações' && unreadCount > 0 && (
                          <span className={cn(
                            "ml-auto bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0 rounded-full min-w-[16px] text-center",
                            !isOpen && "absolute top-1 right-1 border-2 border-white"
                          )}>
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="pt-1 border-t border-slate-100">
              <button 
                onClick={() => {
                  setIsAboutOpen(true)
                  setIsMobileOpen(false)
                }}
                className="flex items-center gap-2 px-2 py-1 w-full rounded-lg transition-all duration-200 group text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-xs"
              >
                <Info size={14} className="shrink-0 text-slate-500 group-hover:text-slate-600" />
                {isOpen && <span>Sobre</span>}
              </button>
            </div>
          </nav>

          {/* Footer */}
          <div className="p-3 pb-6 lg:pb-3 border-t border-slate-200 bg-slate-50/50 flex flex-col shrink-0">
            {isOpen && user && (
              <div className="flex items-center gap-3 mb-3 p-1">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-semibold text-slate-700 truncate">{user.name}</span>
                  <span className="text-xs text-slate-500 truncate">{user.role_name === 'admin' ? 'Administrador' : 'Usuário'}</span>
                </div>
              </div>
            )}
            
            {isOpen && user && (
              <div className="px-3 mb-3">
                <div className="p-2 bg-slate-100 rounded-xl border border-slate-200">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                    Trocar Ambiente
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleSwitchEnv('production')}
                      disabled={isSwitchingEnv || !user.canAccessProdEnv}
                      className={cn(
                        "flex-1 flex flex-col items-center justify-center p-1.5 rounded-lg transition-all",
                        isProduction 
                          ? "bg-emerald-600 text-white shadow-sm" 
                          : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200",
                        !user.canAccessProdEnv && "opacity-50 cursor-not-allowed grayscale"
                      )}
                      title="Ambiente de Produção"
                    >
                      <Globe size={14} />
                      <span className="text-[8px] font-bold mt-0.5">PRODUÇÃO</span>
                    </button>
                    <button
                      onClick={() => handleSwitchEnv('test')}
                      disabled={isSwitchingEnv || !user.canAccessTestEnv}
                      className={cn(
                        "flex-1 flex flex-col items-center justify-center p-1.5 rounded-lg transition-all",
                        !isProduction 
                          ? "bg-amber-500 text-white shadow-sm" 
                          : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200",
                        !user.canAccessTestEnv && "opacity-50 cursor-not-allowed grayscale"
                      )}
                      title="Ambiente de Testes"
                    >
                      <Beaker size={14} />
                      <span className="text-[8px] font-bold mt-0.5">TESTE</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <button 
              onClick={logout}
              className={cn(
                "flex items-center gap-2 px-3 py-2 w-full rounded-lg text-slate-600 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all duration-200 group text-sm font-medium",
                !isOpen && "justify-center px-0 border-transparent bg-transparent hover:bg-rose-50"
              )}
              title="Sair do Sistema"
            >
              <LogOut size={16} className="shrink-0 text-slate-500 group-hover:text-rose-500" />
              {isOpen && <span>Sair do Sistema</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* About Modal */}
      <AnimatePresence>
        {isAboutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAboutOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Sobre o InoveJuris"
            >
              {/* Header */}
              <div className="relative h-36 shrink-0 overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
                <div className="relative z-10 flex h-full items-center justify-between px-6 sm:px-8">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                      <Scale size={24} className="text-indigo-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                          Inove<span className="text-indigo-400">Juris</span>
                        </h2>
                        <span className="rounded-full bg-indigo-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200 ring-1 ring-indigo-300/20">
                          v1.0.0
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                        Sistema de Gestão Jurídica
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAboutOpen(false)}
                    aria-label="Fechar janela Sobre"
                    className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto bg-slate-50/70 p-6 sm:p-8">
                {/* License */}
                <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="relative h-14 w-28 shrink-0 sm:h-16 sm:w-36">
                        <Image 
                          src={settings.office_logo || '/logo-alcantara.png'} 
                          alt="Logomarca do escritório licenciado" 
                          fill
                          className="object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-500">
                          <BadgeCheck size={13} /> Licenciado para
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-800">Escritório licenciado</p>
                        <p className="text-xs text-slate-500">Uso autorizado do InoveJuris</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 self-start rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-600 sm:self-auto">
                      <Globe size={13} /> {envName}
                    </div>
                  </div>
                </div>

                {/* Intro + features */}
                <div className="mt-6">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                      <Sparkles size={17} className="text-indigo-600" />
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">
                      Uma plataforma completa para a rotina do escritório: processos, financeiro e clientes em um só lugar, com informações organizadas e acesso controlado.
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {aboutFeatures.map((feature) => {
                      const Icon = feature.icon
                      return (
                        <div
                          key={feature.title}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200"
                        >
                          <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${feature.tone}`}>
                            <Icon size={17} />
                          </div>
                          <p className="text-sm font-semibold text-slate-800">{feature.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">{feature.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Developer + Support */}
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Desenvolvido por
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-bold text-white shadow-md">
                        IT
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Inove Tecnologia</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin size={12} /> Barreiras - Bahia
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
                      <UserCog size={16} className="shrink-0 text-slate-400" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Responsável
                        </p>
                        <p className="text-sm font-medium text-slate-700">Anderson Alcântara Silva</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600/80">
                      Suporte técnico
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      Precisa de ajuda? Fale diretamente com o nosso time.
                    </p>
                    <a
                      href={supportPhoneHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-white shadow-md transition-colors hover:bg-emerald-700"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <MessageCircle size={17} /> WhatsApp
                      </span>
                      <span className="text-xs font-medium text-emerald-50">{supportPhone}</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                    >
                      {copiedPhone ? <Check size={14} /> : <Copy size={14} />}
                      {copiedPhone ? 'Telefone copiado!' : 'Copiar telefone'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 sm:px-8">
                <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                  <p className="flex items-center gap-2 text-[11px] text-slate-400">
                    <ShieldCheck size={13} className="text-emerald-500" />
                    © 2026 Inove Tecnologia · Versão 1.0.0
                  </p>
                  <p className="text-[11px] text-slate-400">Feito para escritórios de advocacia</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

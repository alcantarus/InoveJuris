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
  const { user, logout, switchEnvironment } = useAuth()
  const { settings } = useSettings()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isSwitchingEnv, setIsSwitchingEnv] = useState(false)

  const isProduction = getIsProduction()
  const envName = getEnvName()

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
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              {/* Header with Modern Gradient */}
              <div className="relative h-32 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
                <div className="relative z-10 flex flex-col items-center text-white text-center px-6">
                  <h2 className="text-3xl font-bold tracking-tight text-white">
                    Inove<span className="text-indigo-400">Juris</span>
                  </h2>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-1">
                    Sistema de Gestão Jurídica
                  </p>
                </div>
                
                <button 
                  onClick={() => setIsAboutOpen(false)}
                  className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors z-20"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 sm:p-8 overflow-y-auto bg-white">
                {/* Client Section (Alcântara Advocacia) */}
                <div className="mb-6">
                  <div className="p-4 rounded-xl border border-slate-100 flex flex-col items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                      Licenciado Para
                    </p>
                    <div className="relative w-full h-16 flex items-center justify-center">
                      {settings.office_logo ? (
                        <Image 
                          src={settings.office_logo} 
                          alt="Logomarca do Escritório" 
                          fill
                          className="object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Image 
                          src="/logo-alcantara.png" 
                          alt="Alcântara Advocacia" 
                          fill
                          className="object-contain"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* System Info */}
                <div className="text-center mb-6">
                  <p className="text-slate-600 leading-relaxed text-sm">
                    O <strong className="text-indigo-700 font-semibold">InoveJuris</strong> é uma solução completa para gestão de escritórios de advocacia, 
                    oferecendo controle total sobre processos, financeiro e relacionamento com clientes.
                  </p>
                </div>
                
                {/* Developer Info */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex flex-col items-center text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Desenvolvido Por
                    </p>
                    <h4 className="font-bold text-slate-800 text-base">Inove Tecnologia</h4>
                    <p className="text-sm text-slate-700 font-medium">Anderson Alcântara Silva</p>
                    <p className="text-xs text-slate-500 font-medium">Barreiras - Bahia</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
                <div className="flex flex-col items-center gap-2">
                  <a 
                    href="https://wa.me/5577999910345" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Suporte Técnico: (77) 9 9991-0345
                  </a>
                  <p className="text-[10px] text-slate-400">
                    Versão 1.0.0 &bull; Copyright &copy; 2026
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

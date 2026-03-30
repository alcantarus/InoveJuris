'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { useAuth, User } from '@/lib/auth'
import { ShieldAlert } from 'lucide-react'

import { GPSNotificationChecker } from '@/components/GPSNotificationChecker'

const PERMISSION_MAP: Record<string, keyof User> = {
  '/': 'canAccessDashboard',
  '/clientes': 'canAccessClients',
  '/advogados': 'canAccessLawyers',
  '/processos': 'canAccessProcesses',
  '/documentos': 'canAccessDocuments',
  '/contratos': 'canAccessContracts',
  '/contas-a-receber': 'canAccessReceivables',
  '/fluxo-caixa': 'canAccessCashFlow',
  '/produtos': 'canAccessProducts',
  '/indicadores': 'canAccessIndicators',
  '/relatorios': 'canAccessReports',
  '/auditoria': 'canAccessAudit',
  '/usuarios': 'canAccessUsers',
  '/configuracoes': 'canAccessSettings',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const hasPermission = useMemo(() => {
    if (!user) return null
    const requiredPermission = PERMISSION_MAP[pathname] || Object.entries(PERMISSION_MAP).find(([path]) => pathname.startsWith(path) && path !== '/')?.[1]
    console.log('DashboardLayout: pathname:', pathname, 'requiredPermission:', requiredPermission, 'user permission:', user[requiredPermission as keyof User]);
    if (requiredPermission && user[requiredPermission as keyof User] === false) {
      return false
    }
    return true
  }, [user, pathname])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading || !user || hasPermission === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (hasPermission === false) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        <Sidebar />
        <main className="flex-1 lg:ml-64 p-4 md:p-6 lg:p-8 transition-all duration-300 mt-16 lg:mt-6 flex items-center justify-center">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Acesso Negado</h2>
            <p className="text-slate-600 mb-6">
              Você não tem permissão para acessar este módulo. Entre em contato com o administrador para solicitar acesso.
            </p>
            <button 
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Voltar ao Início
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <GPSNotificationChecker />
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 md:p-6 lg:p-8 transition-all duration-300 mt-24 lg:mt-6">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

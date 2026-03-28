'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, getSupabase, getSupabaseConfig } from './supabase'
import bcrypt from 'bcryptjs'
import { setCookie, deleteCookie } from 'cookies-next'
import { AppEnv } from './env'

export interface User {
  id: number
  name: string
  email: string
  role_name?: string
  canAccessClients: boolean
  canAccessProcesses: boolean
  canAccessContracts: boolean
  canAccessCashFlow: boolean
  canAccessReceivables: boolean
  canAccessProducts: boolean
  canAccessIndicators: boolean
  canAccessReports: boolean
  canAccessUsers: boolean
  canAccessSettings: boolean
  canAccessAudit: boolean
  canAccessLawyers: boolean
  canAccessDocuments: boolean
  canAccessDocTemplates: boolean
  canAccessDocGeneration: boolean
  canAccessDashboard: boolean
  canAccessProdEnv: boolean
  canAccessTestEnv: boolean
  is_superadmin: boolean
  expiration_date?: string
  selectedEnv?: AppEnv
  sessionId?: string
}

const calculatePermissions = (userDataFromDb: any, selectedEnv: AppEnv) => {
  const roleName = userDataFromDb.user_roles?.[0]?.roles?.name;
  const isAdmin = roleName === 'Administrador' || userDataFromDb.email === 'admin@admin.com';
  const isSuperadmin = userDataFromDb.is_superadmin === true || userDataFromDb.email === 'admin@admin.com';
  
  const rolePermissions = userDataFromDb.user_roles?.[0]?.roles?.role_permissions || [];
  const permissionSlugs = rolePermissions.map((rp: any) => rp.permissions?.slug);

  const hasPermission = (slug: string) => isAdmin || permissionSlugs.includes(slug);

  return {
    id: userDataFromDb.id,
    name: userDataFromDb.name,
    email: userDataFromDb.email,
    role_name: roleName,
    is_superadmin: isSuperadmin,
    canAccessClients: hasPermission('access_clients') || userDataFromDb.canAccessClients,
    canAccessProcesses: hasPermission('access_processes') || userDataFromDb.canAccessProcesses,
    canAccessContracts: hasPermission('access_finance') || userDataFromDb.canAccessFinance,
    canAccessCashFlow: hasPermission('access_cashflow') || userDataFromDb.canAccessCashFlow,
    canAccessReceivables: hasPermission('access_receivables') || userDataFromDb.canAccessReceivables,
    canAccessProducts: hasPermission('access_products') || userDataFromDb.canAccessProducts,
    canAccessIndicators: hasPermission('access_indicators') || userDataFromDb.canAccessIndicators,
    canAccessReports: hasPermission('access_reports') || userDataFromDb.canAccessReports,
    canAccessUsers: hasPermission('access_users') || userDataFromDb.canAccessUsers,
    canAccessSettings: hasPermission('access_settings') || userDataFromDb.canAccessSettings,
    canAccessAudit: hasPermission('access_audit') || userDataFromDb.canAccessAudit,
    canAccessLawyers: hasPermission('access_lawyers') || userDataFromDb.canAccessLawyers,
    canAccessDocuments: hasPermission('access_documents') || userDataFromDb.canAccessDocuments,
    canAccessDocTemplates: hasPermission('access_doc_templates') || userDataFromDb.canAccessDocTemplates,
    canAccessDocGeneration: hasPermission('access_doc_generation') || userDataFromDb.canAccessDocGeneration,
    canAccessDashboard: hasPermission('access_dashboard') || userDataFromDb.canAccessDashboard !== false,
    canAccessProdEnv: hasPermission('access_prod_env') || userDataFromDb.canAccessProdEnv !== false,
    canAccessTestEnv: hasPermission('access_test_env') || userDataFromDb.canAccessTestEnv,
    selectedEnv: selectedEnv
  } as User;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const storedUser = localStorage.getItem('inovejuris_user')
    if (!storedUser) return

    const userObj = JSON.parse(storedUser)
    const email = userObj.email
    const selectedEnv = userObj.selectedEnv

    // Fetch user from DB
    const authClient = getSupabase()

    const { data, error } = await authClient
      .from('users')
      .select(`
        *,
        user_roles!user_id (
          role_id,
          roles (
            name,
            role_permissions (
              permissions (slug)
            )
          )
        )
      `)
      .eq('email', email)
      .single()

    if (error || !data) return

    const userData = calculatePermissions(data, selectedEnv);
    localStorage.setItem('inovejuris_user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  useEffect(() => {
    const storedUser = localStorage.getItem('inovejuris_user')
    if (storedUser) {
      setTimeout(() => {
        setUser(JSON.parse(storedUser))
        refreshUser() // Refresh permissions on load
        setLoading(false)
      }, 0)
    } else {
      setTimeout(() => {
        setLoading(false)
      }, 0)
    }
  }, [refreshUser])

  const validateCredentials = async (email: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> => {
    console.log('[Auth] Iniciando validação para:', email)
    
    try {
      // Check rate limit first
      try {
        const rateRes = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_rate_limit', email })
        })
        const rateData = await rateRes.json()
        if (!rateData.allowed) {
          return { success: false, error: rateData.error }
        }
      } catch (e) {
        console.error('Rate limit check failed', e)
      }

      // Debug: Check if we are using placeholder
      const prodConfigCheck = getSupabaseConfig('production')
      const supabaseUrl = prodConfigCheck.url
      console.log('[Auth] URL do Supabase Prod:', supabaseUrl)
      
      if (supabaseUrl.includes('placeholder')) {
         console.error('[Auth] Usando URL de placeholder. Verifique as variáveis de ambiente.')
         return { success: false, error: 'Erro de configuração: Variáveis de ambiente do Supabase não detectadas.' }
      }

      // Always validate against Production as the source of truth for users
      // We temporarily bypass the proxy to ensure we always hit production for auth
      const authClient = getSupabase()

      const { data, error } = await authClient
        .from('users')
        .select(`
          *,
          user_roles!user_id (
            role_id,
            roles (
              name,
              role_permissions (
                permissions (slug)
              )
            )
          )
        `)
        .eq('email', email)
        .single()

      const logFailure = async (reason: string) => {
        try {
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login_failed', email, reason, userAgent: navigator.userAgent })
          })
        } catch (e) {
          console.error('Failed to log failure', e)
        }
      }

      if (error) {
        console.error('[Auth] Erro no banco de dados:', error)
        if (error.code === 'PGRST116') {
             await logFailure('Usuário não encontrado')
             return { success: false, error: 'Usuário não encontrado.' }
        }
        return { success: false, error: `Erro de conexão: ${error.message}` }
      }

      if (!data) {
        console.error('[Auth] Nenhum dado retornado.')
        await logFailure('Usuário não encontrado')
        return { success: false, error: 'Usuário não encontrado.' }
      }

      console.log('[Auth] Usuário encontrado. Verificando senha...')

      let isMatch = false
      try {
        isMatch = bcrypt.compareSync(password, data.password)
      } catch (e) {
        console.warn('[Auth] Falha no bcrypt, tentando texto plano')
        isMatch = false
      }

      if (!isMatch && password === data.password) {
        console.log('[Auth] Senha em texto plano validada com sucesso')
        isMatch = true
      }

      if (!isMatch) {
        console.error('[Auth] Senha incorreta')
        await logFailure('Senha incorreta')
        return { success: false, error: 'Senha incorreta.' }
      }

      // Check for expiration
      if (data.expiration_date) {
        const expirationDate = new Date(data.expiration_date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        if (today > expirationDate) {
          await logFailure('Conta expirada')
          return { success: false, error: 'Seu acesso ao sistema expirou. Entre em contato com o administrador.' }
        }
      }

      console.log('[Auth] Login validado com sucesso')
      return { success: true, user: data }
    } catch (err: any) {
      console.error('[Auth] Erro inesperado:', err)
      return { success: false, error: `Erro inesperado: ${err.message || 'Desconhecido'}` }
    }
  }

  const login = async (userDataFromDb: any, selectedEnv: AppEnv): Promise<{ success: boolean; error?: string }> => {
    console.log('[Auth] Iniciando login...');
    try {
      // Check permission for production environment
      if (selectedEnv === 'production' && userDataFromDb.canAccessProdEnv === false) {
        console.log('[Auth] Erro: Sem permissão para produção');
        return { success: false, error: 'Você não tem permissão para acessar o Ambiente de Produção.' }
      }

      // Check permission for test environment
      if (selectedEnv === 'test' && !userDataFromDb.canAccessTestEnv) {
        console.log('[Auth] Erro: Sem permissão para teste');
        return { success: false, error: 'Você não tem permissão para acessar o Ambiente de Teste.' }
      }

      const userData = calculatePermissions(userDataFromDb, selectedEnv);
      console.log('[Auth] Permissões calculadas:', userData);

      // Create session record
      let sessionId = undefined;
      try {
        console.log('[Auth] Chamando API de sessão...');
        const res = await fetch(`${window.location.origin}/api/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            userId: userData.id,
            environment: selectedEnv,
            userAgent: navigator.userAgent
          })
        });
        
        const data = await res.json();
        
        if (!res.ok || !data.success) {
          console.error('[Auth] Erro ao criar sessão:', data.error || 'Erro desconhecido');
          return { success: false, error: 'Erro ao registrar sessão de acesso. Tente novamente.' }
        }
        
        console.log('[Auth] Sessão criada com sucesso, ID:', data.sessionId);
        sessionId = data.sessionId;
        userData.sessionId = sessionId;
      } catch (err) {
        console.error('[Auth] Falha crítica ao chamar API de sessão:', err);
        return { success: false, error: 'Erro ao conectar ao servidor de sessão.' }
      }

      // Set environment cookie with security settings for iframe compatibility
      setCookie('app_env', selectedEnv, { 
        maxAge: 60 * 60 * 24 * 7, 
        path: '/',
        sameSite: 'none',
        secure: true
      }) // 7 days

      localStorage.setItem('inovejuris_user', JSON.stringify(userData))
      localStorage.setItem('session_last_activity', Date.now().toString())
      setUser(userData)
      
      // Force a reload to ensure all components and the supabase client use the new environment
      console.log('[Auth] Login finalizado, recarregando página...');
      window.location.href = '/'
      return { success: true }
    } catch (err) {
      console.error('[Auth] Erro no login:', err);
      return { success: false, error: 'Erro ao finalizar o login.' }
    }
  }

  const logout = async () => {
    const storedUser = localStorage.getItem('inovejuris_user')
    if (storedUser) {
      const userObj = JSON.parse(storedUser)
      if (userObj.sessionId) {
        try {
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'logout',
              sessionId: userObj.sessionId
            })
          });
        } catch (err) {
          console.error('Failed to logout session:', err);
        }
      }
    }

    localStorage.removeItem('inovejuris_user')
    localStorage.removeItem('session_last_activity')
    deleteCookie('app_env')
    setUser(null)
    window.location.href = '/login'
  }

  const impersonate = async (targetUserId: number, selectedEnv: AppEnv): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!user || user.role_name !== 'Administrador' && user.email !== 'admin@admin.com') {
        return { success: false, error: 'Apenas administradores podem acessar como outro usuário.' }
      }

      const authClient = getSupabase()

      const { data: targetUser, error } = await authClient
        .from('users')
        .select(`
          *,
          user_roles!user_id (
            role_id,
            roles (
              name,
              role_permissions (
                permissions (slug)
              )
            )
          )
        `)
        .eq('id', targetUserId)
        .single()

      if (error || !targetUser) {
        return { success: false, error: 'Usuário não encontrado.' }
      }

      // Log the impersonation
      try {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'impersonate',
            adminId: user.id,
            targetUserId: targetUserId,
            environment: selectedEnv,
            userAgent: navigator.userAgent
          })
        });
      } catch (err) {
        console.error('Failed to log impersonation:', err);
      }

      // Login as the target user
      return await login(targetUser, selectedEnv)
    } catch (err) {
      return { success: false, error: 'Erro ao acessar como usuário.' }
    }
  }

  const switchEnvironment = async (newEnv: AppEnv): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Usuário não autenticado.' };

    // Check permissions
    if (newEnv === 'production' && user.canAccessProdEnv === false) {
      return { success: false, error: 'Você não tem permissão para acessar o Ambiente de Produção.' };
    }
    if (newEnv === 'test' && !user.canAccessTestEnv) {
      return { success: false, error: 'Você não tem permissão para acessar o Ambiente de Teste.' };
    }

    try {
      const updatedUser = { ...user, selectedEnv: newEnv };
      
      // Set environment cookie
      setCookie('app_env', newEnv, { 
        maxAge: 60 * 60 * 24 * 7, 
        path: '/',
        sameSite: 'none',
        secure: true
      });

      localStorage.setItem('inovejuris_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      // Force reload to apply changes
      window.location.reload();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Erro ao trocar de ambiente.' };
    }
  };

  return { user, loading, validateCredentials, login, logout, refreshUser, impersonate, switchEnvironment }
}

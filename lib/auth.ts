'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, getSupabase, supabaseUrl } from './supabase'
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
  organizationId?: string
  sessionId?: string
}

const calculatePermissions = (userDataFromDb: any, organizationId: string) => {
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
    organizationId: organizationId
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
    const organizationId = userObj.organizationId

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

    const userData = calculatePermissions(data, organizationId);
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

  const login = async (userDataFromDb: any, organizationId: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[Auth] Iniciando login...');
    try {
      // TODO: Check permission for organization
      
      const userData = calculatePermissions(userDataFromDb, organizationId);
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
            organizationId: organizationId,
            userAgent: navigator.userAgent
          })
        });
        
        const data = await res.json();
        
        if (!res.ok || !data.success) {
          console.error('[Auth] Erro ao criar sessão:', data.error || 'Erro desconhecido', data.details || '', data.code || '');
          return { success: false, error: `Erro ao registrar sessão de acesso: ${data.details || data.error || 'Tente novamente.'}` }
        }
        
        console.log('[Auth] Sessão criada com sucesso, ID:', data.sessionId);
        sessionId = data.sessionId;
        userData.sessionId = sessionId;
      } catch (err) {
        console.error('[Auth] Falha crítica ao chamar API de sessão:', err);
        return { success: false, error: 'Erro ao conectar ao servidor de sessão.' }
      }

      // Set organization cookie
      setCookie('app_org', organizationId, { 
        maxAge: 60 * 60 * 24 * 7, 
        path: '/',
        sameSite: 'none',
        secure: true
      }) // 7 days

      localStorage.setItem('inovejuris_user', JSON.stringify(userData))
      localStorage.setItem('app_org', organizationId)
      localStorage.setItem('session_last_activity', Date.now().toString())
      setUser(userData)
      
      // Force a reload to ensure all components and the supabase client use the new organization
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

    // Limpar contexto do banco de dados
    try {
      const authClient = getSupabase();
      await authClient.rpc('clear_app_context');
    } catch (err) {
      console.error('Failed to clear app context:', err);
    }

    localStorage.removeItem('inovejuris_user')
    localStorage.removeItem('session_last_activity')
    localStorage.removeItem('app_org')
    deleteCookie('app_org')
    setUser(null)
    window.location.href = '/login'
  }

  const impersonate = async (targetUserId: number, organizationId: string): Promise<{ success: boolean; error?: string }> => {
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
            organizationId: organizationId,
            userAgent: navigator.userAgent
          })
        });
      } catch (err) {
        console.error('Failed to log impersonation:', err);
      }

      // Login as the target user
      return await login(targetUser, organizationId)
    } catch (err) {
      return { success: false, error: 'Erro ao acessar como usuário.' }
    }
  }

  const setOrganizationContext = async (orgId: string) => {
    const authClient = getSupabase();
    const { error } = await authClient.rpc('set_app_organization', { org_id: orgId });
    if (error) console.error('Erro ao definir contexto de organização:', error);
  };

  const switchOrganization = async (newOrgId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Usuário não autenticado.' };

    try {
      // 1. Atualizar no banco de dados (contexto da sessão)
      await setOrganizationContext(newOrgId);

      // 2. Atualizar cookies e localStorage
      setCookie('app_org', newOrgId, { 
        maxAge: 60 * 60 * 24 * 7, 
        path: '/',
        sameSite: 'none',
        secure: true
      });
      localStorage.setItem('app_org', newOrgId);

      // 3. Atualizar o objeto de usuário no localStorage
      const storedUser = localStorage.getItem('inovejuris_user');
      if (storedUser) {
        const userObj = JSON.parse(storedUser);
        userObj.organizationId = newOrgId;
        localStorage.setItem('inovejuris_user', JSON.stringify(userObj));
        setUser(userObj);
      }

      // 4. Recarregar a página para aplicar as mudanças
      window.location.reload();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao trocar de organização:', err);
      return { success: false, error: 'Erro ao trocar de organização.' };
    }
  };

  const fetchUserOrganizations = async (userId: number) => {
    console.log('[Auth] Buscando organizações para userId:', userId)
    const authClient = getSupabase()
    
    // 1. Busca os vínculos
    const { data: userOrgs, error: userOrgsError } = await authClient
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', userId)

    if (userOrgsError) {
      console.error('[Auth] Erro ao buscar vínculos:', userOrgsError)
      return []
    }

    if (!userOrgs || userOrgs.length === 0) {
      console.log('[Auth] Organizações encontradas: []')
      return []
    }

    // 2. Busca os detalhes das organizações
    const orgIds = userOrgs.map(uo => uo.organization_id)
    const { data: orgs, error: orgsError } = await authClient
      .from('organizations')
      .select('id, name, slug, is_demo')
      .in('id', orgIds)

    if (orgsError) {
      console.error('[Auth] Erro ao buscar detalhes das organizações:', orgsError)
      return []
    }

    console.log('[Auth] Organizações encontradas:', orgs)
    return orgs || []
  }

  const switchEnvironment = async (targetEnv: AppEnv): Promise<{ success: boolean; error?: string }> => {
    try {
      // Atualizar no localStorage para persistência
      localStorage.setItem('NEXT_PUBLIC_APP_ENV', targetEnv);
      
      // Recarregar a página para aplicar as mudanças
      window.location.reload();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao trocar de ambiente:', err);
      return { success: false, error: 'Erro ao trocar de ambiente.' };
    }
  };

  return { user, loading, validateCredentials, login, logout, refreshUser, impersonate, switchOrganization, fetchUserOrganizations, switchEnvironment, setOrganizationContext }
}

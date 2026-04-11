'use client'

import React, { useEffect, useState } from 'react'
import DashboardLayout from '@/app/dashboard-layout'
import { supabase } from '@/lib/supabase'
import { getAppEnv } from '@/lib/env'
import { useAuth } from '@/lib/auth'
import { Bell, CheckCircle2, Trash2, AlertTriangle, Info, CheckCircle, Cake } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const fetchNotifications = React.useCallback(async () => {
    if (!user?.id) return

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('environment', getAppEnv())
      .order('created_at', { ascending: false })
    
    if (error) console.error('Error fetching notifications:', error)
    else {
      console.log('Full notification data:', data)
      // Filtra notificações lidas em memória, similar à lógica de aniversariantes
      setNotifications((data || []).filter((n: any) => !n.is_read))
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user?.id) {
      const initialize = async () => {
        await fetchNotifications()
      }
      initialize()
      
      // Subscribe to real-time updates
      const channel = supabase
        .channel('notifications-page')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchNotifications()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, fetchNotifications])

  const markAsRead = async (id: number) => {
    if (!user?.id) return;
    
    console.log('[Notifications] Marking as read:', id);
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('environment', getAppEnv());

      if (error) {
        console.error('[Notifications] Error marking as read:', error);
      } else {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('[Notifications] Unexpected error marking as read:', err);
    }
  }

  const deleteNotification = async (id: number) => {
    if (!user?.id) return;
    
    console.log('[Notifications] Deleting notification:', id);
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('environment', getAppEnv());

      if (error) {
        console.error('[Notifications] Error deleting notification:', error);
        alert('Erro ao excluir notificação.');
      } else {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('[Notifications] Unexpected error deleting notification:', err);
    }
  }

  const markAllAsRead = async () => {
    if (!user?.id) return
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
      .eq('user_id', user.id)
      .eq('environment', getAppEnv())
    
    if (error) console.error('Error marking all as read:', error)
    else {
      // Remove todas as notificações da lista local, pois todas foram marcadas como lidas
      setNotifications([])
    }
  }

  const sendTestNotification = async () => {
    if (!user?.id) {
      console.error('[Notifications] No user ID found for test notification');
      return
    }
    
    console.log('[Notifications] Sending test notification for user:', user.id);
    
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          title: 'Notificação de Teste',
          message: 'Esta é uma notificação de teste para verificar se o sistema está funcionando.',
          type: 'success',
          user_id: user.id,
          is_read: false,
          environment: getAppEnv()
        });
      
      if (error) {
        console.error('[Notifications] Supabase error:', error);
        alert('Erro ao enviar notificação de teste: ' + error.message);
      } else {
        console.log('[Notifications] Test notification sent successfully');
        fetchNotifications();
        alert('Notificação de teste enviada com sucesso!');
      }
    } catch (err) {
      console.error('[Notifications] Unexpected error:', err);
      alert('Erro inesperado ao enviar notificação.');
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={20} className="text-amber-600" />
      case 'error': return <AlertTriangle size={20} className="text-rose-600" />
      case 'success': return <CheckCircle size={20} className="text-emerald-600" />
      case 'birthday': return <Cake size={20} className="text-pink-600" />
      default: return <Info size={20} className="text-indigo-600" />
    }
  }

  const getBgColor = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-amber-50'
      case 'error': return 'bg-rose-50'
      case 'success': return 'bg-emerald-50'
      case 'birthday': return 'bg-pink-50'
      default: return 'bg-indigo-50'
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Notificações</h1>
          <div className="flex items-center gap-4">
            <button 
              onClick={sendTestNotification}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Bell size={16} />
              Enviar Teste
            </button>
            {notifications.some(n => !n.is_read) && (
              <button 
                onClick={markAllAsRead}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                Marcar todas como lidas
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">Carregando notificações...</div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Bell size={48} className="mx-auto mb-4 opacity-20" />
              <p>Nenhuma notificação encontrada.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <li key={n.id} className={cn(
                  "p-5 flex items-start gap-4 transition-colors",
                  !n.is_read ? "bg-slate-50/50" : "opacity-70"
                )}>
                  <div className={cn("p-2 rounded-xl", getBgColor(n.type))}>
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={cn("font-bold text-slate-900", !n.is_read ? "text-base" : "text-sm")}>
                        {n.title}
                      </h3>
                      {!n.is_read && <span className="w-2 h-2 bg-indigo-600 rounded-full" />}
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-2">{n.message}</p>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      {new Date(n.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!n.is_read && (
                      <button 
                        onClick={() => markAsRead(n.id)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Marcar como lida"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNotification(n.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useSettings } from '@/components/providers/SettingsProvider';
import { useAuth } from '@/lib/auth';
import { setSessionToken } from '@/lib/session-token';

export function SessionMonitor() {
  const router = useRouter();
  const pathname = usePathname();
  const { settings, loading } = useSettings();
  const { user, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const terminationHandled = useRef(false);

  // Cada novo login deve poder exibir o aviso de sessão encerrada uma vez.
  useEffect(() => {
    if (user) terminationHandled.current = false;
  }, [user]);

  // Avoid running on login page
  const isLoginPage = pathname === '/login';

  const checkSession = useCallback(() => {
    if (isLoginPage || loading) return;

    const { enabled, minutes, warning_minutes } = settings.session_timeout;

    if (!enabled) {
      setShowWarning(false);
      return;
    }

    const lastActivity = parseInt(localStorage.getItem('session_last_activity') || Date.now().toString(), 10);

    const now = Date.now();
    const idleTime = now - lastActivity;
    const timeoutMs = minutes * 60 * 1000;
    const warningMs = warning_minutes * 60 * 1000;

    // If idle time exceeds timeout, logout
    if (idleTime >= timeoutMs) {
      localStorage.removeItem('session_last_activity');
      logout(); // This will call the API to set logout_at and redirect
      return;
    }

    // If idle time is within the warning period
    if (idleTime >= timeoutMs - warningMs) {
      setShowWarning(true);
      setTimeLeft(Math.ceil((timeoutMs - idleTime) / 1000));
    } else {
      setShowWarning(false);
    }
  }, [isLoginPage, loading, settings.session_timeout, logout]);

  const updateActivity = useCallback(() => {
    if (isLoginPage) return;
    
    // Don't auto-update if warning is showing - force user to click "Continuar"
    if (showWarning) return;

    localStorage.setItem('session_last_activity', Date.now().toString());
  }, [isLoginPage, showWarning]);

  // Heartbeat logic
  useEffect(() => {
    if (isLoginPage || !user) return;

    const sendHeartbeat = async () => {
      try {
        // O identificador da sessão está apenas no cookie httpOnly.
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'heartbeat' })
        });

        if (res.status === 401) {
          if (terminationHandled.current) return;
          terminationHandled.current = true;
          alert('Sua sessão foi encerrada: a aba foi fechada, houve novo login ou um administrador encerrou o acesso.');
          await logout();
          return;
        }

        if (res.ok) {
          // O heartbeat renova o token de sessão antes de ele vencer.
          const data = await res.json().catch(() => null);
          if (data?.token) setSessionToken(data.token);
          localStorage.setItem('session_last_activity', Date.now().toString());
          sessionStorage.setItem('inovejuris_browser_session_open', '1');
        }
      } catch (error) {
        console.error('Falha ao atualizar a sessão:', error);
      }
    };

    // Heartbeat a cada 20s: o servidor tolera 90s sem sinal antes de expirar.
    const interval = setInterval(sendHeartbeat, 20 * 1000);

    // Send initial heartbeat after 5 seconds
    const initialTimeout = setTimeout(sendHeartbeat, 5 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [user, logout, isLoginPage]);

  // Aviso de fechamento da aba/janela. O sendBeacon funciona durante o
  // descarregamento e envia os cookies httpOnly da sessão ao servidor.
  //
  // Cuidado: no celular/tablet o navegador também dispara pagehide quando o
  // usuário navega para outra página do sistema, troca de app, bloqueia a tela
  // ou abre o teclado. Nesses casos o aviso NÃO deve ser enviado, senão
  // `app_logout_all_user_sessions` encerra a sessão em todos os dispositivos.
  // Para esses cenários vale a tolerância de 90 s do servidor.
  useEffect(() => {
    if (isLoginPage || !user) return;

    let closeNotified = false;
    let navigatingInsideApp = false;
    let navigationResetTimer: ReturnType<typeof setTimeout> | null = null;

    // Ponteiro grosso = celular/tablet. Nesses aparelhos não há sinal
    // confiável que diferencie "fechou a aba" de "trocou de app".
    const isTouchDevice =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;

    const markInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin === window.location.origin && url.href !== window.location.href) {
          navigatingInsideApp = true;
          // Se a navegação for cancelada, volta a permitir o aviso de fechamento.
          if (navigationResetTimer) clearTimeout(navigationResetTimer);
          navigationResetTimer = setTimeout(() => {
            navigatingInsideApp = false;
          }, 5000);
        }
      } catch {
        // href inválido: ignora
      }
    };

    const notifyClose = () => {
      if (closeNotified) return;
      if (isTouchDevice) return; // celular/tablet: usa a tolerância de 90 s
      if (navigatingInsideApp) return; // navegação interna não é fechamento
      closeNotified = true;

      const payload = JSON.stringify({ action: 'close_session' });

      if (typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(
          '/api/auth/session',
          new Blob([payload], { type: 'application/json' })
        );
        return;
      }

      void fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        credentials: 'same-origin',
        keepalive: true,
      }).catch(() => undefined);
    };

    const handlePageHide = () => {
      // Reload mantém a página visível; aba/janela fechada ou saída do sistema
      // passa por visibilitychange -> hidden antes do pagehide.
      if (document.visibilityState === 'hidden') {
        notifyClose();
      }
    };
    const handleBeforeUnload = () => {
      if (document.visibilityState === 'hidden') {
        notifyClose();
      }
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      // Retorno do BFCache: a aba voltou a existir e pode gerar novo aviso.
      if (event.persisted) {
        closeNotified = false;
        navigatingInsideApp = false;
      }
    };

    document.addEventListener('click', markInternalNavigation, true);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      if (navigationResetTimer) clearTimeout(navigationResetTimer);
      document.removeEventListener('click', markInternalNavigation, true);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [user, isLoginPage]);

  useEffect(() => {
    if (isLoginPage) return;

    // Initialize last activity
    if (!localStorage.getItem('session_last_activity')) {
      localStorage.setItem('session_last_activity', Date.now().toString());
    }

    // Check session every second
    const intervalId = setInterval(checkSession, 1000);

    // Activity listeners - added mousemove and scroll back
    const events = ['mousedown', 'keydown', 'touchstart', 'click', 'mousemove', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      clearInterval(intervalId);
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [checkSession, updateActivity, isLoginPage]);

  // Keep session alive manually
  const handleContinueSession = () => {
    localStorage.setItem('session_last_activity', Date.now().toString());
    setShowWarning(false);
  };

  if (!showWarning) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 m-4 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-4 mx-auto">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
        </div>
        <h2 className="text-xl font-semibold text-center text-slate-900 mb-2">
          Sessão Expirando
        </h2>
        <p className="text-center text-slate-600 mb-6">
          Por motivos de segurança, sua sessão será encerrada em{' '}
          <span className="font-bold text-slate-900">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>{' '}
          devido à inatividade.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => logout()}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Sair Agora
          </button>
          <button
            onClick={handleContinueSession}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            Continuar Conectado
          </button>
        </div>
      </div>
    </div>
  );
}

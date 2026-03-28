'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useSettings } from '@/components/providers/SettingsProvider';
import { useAuth } from '@/lib/auth';

export function SessionMonitor() {
  const router = useRouter();
  const pathname = usePathname();
  const { settings, loading } = useSettings();
  const { user, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

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
    if (isLoginPage || !user || !user.sessionId) return;

    const sendHeartbeat = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'heartbeat',
            sessionId: user.sessionId
          })
        });

        if (res.status === 401) {
          alert('Sua sessão foi encerrada por um administrador ou por um novo login.');
          logout();
        }
      } catch (error) {
        console.error('Failed to send heartbeat:', error);
      }
    };

    // Send heartbeat every 30 seconds to quickly detect remote termination
    const interval = setInterval(sendHeartbeat, 30 * 1000);

    // Send initial heartbeat after 5 seconds
    const initialTimeout = setTimeout(sendHeartbeat, 5 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [user, logout, isLoginPage]);

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

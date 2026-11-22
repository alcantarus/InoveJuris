'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getAppEnv } from '@/lib/env';
import { normalizeSessionTimeout } from '@/lib/session-timeout';

interface SystemSettings {
  session_timeout: {
    enabled: boolean;
    /** Valor canônico em segundos (30 s a 1800 s). */
    seconds: number;
    warning_seconds: number;
    /** Compatibilidade com clientes antigos. */
    minutes: number;
    warning_minutes: number;
  };
  maintenance_mode: {
    enabled: boolean;
  };
  general_preferences: {
    timezone: string;
    date_format: string;
  };
  appearance: {
    theme: 'light';
    primary_color: string;
  };
  dashboard_goals: {
    monthly_revenue: number;
    win_rate_target: number;
    lead_time_target: number;
  };
  smtp_config: {
    host: string;
    port: number;
    user: string;
    password?: string;
    pass?: string;
    secure?: boolean;
    from_email?: string;
  };
  webhooks: any[];
  [key: string]: any;
}

interface SettingsContextType {
  settings: SystemSettings;
  loading: boolean;
  updateSetting: (key: string, value: any) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: SystemSettings = {
  session_timeout: { enabled: false, seconds: 1800, warning_seconds: 300, minutes: 30, warning_minutes: 5 },
  maintenance_mode: { enabled: false },
  general_preferences: { timezone: 'America/Sao_Paulo', date_format: 'DD/MM/YYYY' },
  appearance: { theme: 'light', primary_color: 'indigo' },
  dashboard_goals: { 
    monthly_revenue: 150000, 
    win_rate_target: 80, 
    lead_time_target: 45 
  },
  smtp_config: { host: '', port: 587, user: '', password: '', secure: false, from_email: '' },
  webhooks: [],
  last_backup_date: null,
  office_logo: ''
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: true,
  updateSetting: async () => {},
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Dedupe de requisições em voo. Sem isso, mount + callback do Realtime
  // podiam disparar a mesma consulta duas vezes numa janela curta (a
  // segunda consulta aparecia em pg_stat_statements com 2 chamadas).
  const inFlightRef = useRef<Promise<void> | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      // The supabase client proxy automatically adds .eq('environment', APP_ENV)
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');

      if (error) {
        console.error('Error fetching settings:', error);
        return;
      }

      if (data) {
        const newSettings = { ...defaultSettings };
        data.forEach((item: any) => {
          let value = item.value;
          // Handle case where value might be stored as a string in a TEXT column
          if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
            try {
              value = JSON.parse(value);
            } catch (e) {
              // Not JSON, keep as string
            }
          }
          newSettings[item.key as keyof SystemSettings] = value;

          // session_timeout é normalizado: aceita o formato novo (segundos) e
          // o antigo (minutos), clampa 30 s–1800 s e evita NaN/valores vazios.
          if (item.key === 'session_timeout') {
            const config = normalizeSessionTimeout(value);
            newSettings.session_timeout = {
              enabled: config.enabled,
              seconds: config.seconds,
              warning_seconds: config.warningSeconds,
              minutes: Number((config.seconds / 60).toFixed(3)),
              warning_minutes: Number((config.warningSeconds / 60).toFixed(3)),
            };
          }
        });
        setSettings(newSettings);
      }
    } catch (err) {
      console.error('Error in fetchSettings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // `force=true` ignora a promise em voo — usado quando os dados podem ter
  // mudado desde que a busca anterior começou (Realtime e rollback).
  const fetchSettings = useCallback((force = false): Promise<void> => {
    if (!force && inFlightRef.current) return inFlightRef.current;

    const promise = loadSettings().finally(() => {
      if (inFlightRef.current === promise) inFlightRef.current = null;
    });
    inFlightRef.current = promise;
    return promise;
  }, [loadSettings]);

  useEffect(() => {
    fetchSettings();

    // Subscribe to realtime changes
    // Realtime channels are NOT intercepted by the proxy, so we need to filter manually
    const channel = supabase
      .channel('system_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: `environment=eq.${getAppEnv()}`,
        },
        () => {
          // A mudança pode ter ocorrido depois que uma busca anterior
          // começou: força uma nova leitura em vez de reaproveitar a promise.
          fetchSettings(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  useEffect(() => {
    // Force light theme
    const root = window.document.documentElement;
    root.classList.remove('dark');

    // Apply primary color (as a CSS variable)
    const primaryColor = settings.appearance?.primary_color || 'indigo';
    root.style.setProperty('--primary-color', `var(--color-${primaryColor}-600)`);
    root.style.setProperty('--primary-color-hover', `var(--color-${primaryColor}-700)`);
  }, [settings.appearance]);

  const updateSetting = async (key: string, value: any) => {
    try {
      // Optimistic update
      setSettings((prev) => ({ ...prev, [key]: value }));

      // A gravação passa pelo servidor: a rota valida a sessão, define o
      // environment e o updated_by, e usa a service role — o anon não tem
      // mais permissão de escrita em system_settings.
      const response = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
      const payload = isJson ? await response.json().catch(() => null) : null;

      // `!isJson` cobre o redirecionamento para /login (HTML 200) quando a
      // sessão já não existe: sem isso pareceria sucesso.
      if (!response.ok || !isJson) {
        console.error(`Error updating setting ${key}:`, payload ?? response.status);
        // Revert optimistic update by fetching from server
        fetchSettings(true);
        throw new Error(payload?.error || `Falha ao salvar a configuração ${key} (${response.status}).`);
      }
    } catch (err) {
      console.error(`Error in updateSetting for ${key}:`, err);
      throw err;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSetting, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);

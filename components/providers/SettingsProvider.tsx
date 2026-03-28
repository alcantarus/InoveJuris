'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { getAppEnv } from '@/lib/env';

interface SystemSettings {
  session_timeout: {
    enabled: boolean;
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
  session_timeout: { enabled: false, minutes: 30, warning_minutes: 5 },
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
  const { user } = useAuth();

  const fetchSettings = async () => {
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
        });
        setSettings(newSettings);
      }
    } catch (err) {
      console.error('Error in fetchSettings:', err);
    } finally {
      setLoading(false);
    }
  };

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
        (payload: any) => {
          console.log('Settings changed:', payload);
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

      const env = getAppEnv();
      
      // The supabase client proxy automatically adds environment: APP_ENV to the payload
      // We explicitly pass the environment and key to ensure onConflict works correctly
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key,
          value,
          environment: env, // Explicitly include for clarity
          updated_at: new Date().toISOString(),
          ...(user?.id ? { updated_by: user.id } : {}),
        }, {
          onConflict: 'key,environment'
        });

      if (error) {
        console.error(`Error updating setting ${key}:`, JSON.stringify(error, null, 2));
        // Revert optimistic update by fetching from server
        fetchSettings();
        // Try to get more details from the error object
        const details = typeof error === 'object' ? JSON.stringify(error) : String(error);
        throw new Error(details);
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

import { getCookie } from 'cookies-next';

export type AppEnv = 'production' | 'test';

export const getAppEnv = (): AppEnv => {
  // Try to get from environment variable first (consistent across server/client)
  const defaultEnv = (process.env.NEXT_PUBLIC_APP_ENV as AppEnv) || 'production';

  if (typeof window === 'undefined') {
    // Server-side: we cannot read cookies synchronously in Next.js 15.
    // Return the environment variable value or 'production'.
    return defaultEnv;
  }
  
  // Client-side: try to get from html dataset (set in RootLayout)
  const env = document.documentElement.dataset.env as AppEnv;
  
  return env || defaultEnv;
};

export const getEnvConfig = (env: AppEnv) => {
  const isProd = env === 'production';
  return {
    isProduction: isProd,
    isTest: !isProd,
    name: isProd ? 'Ambiente de Produção' : 'Ambiente de Testes',
    color: isProd ? 'indigo' : 'amber',
  };
};

// For backward compatibility and easy access in components
// Note: These are now functions to ensure they get the current value
export const getIsProduction = () => getAppEnv() === 'production';
export const getIsTest = () => getAppEnv() === 'test';
export const getEnvName = () => getAppEnv() === 'production' ? 'Ambiente de Produção' : 'Ambiente de Testes';
export const getEnvColor = () => getAppEnv() === 'production' ? 'indigo' : 'amber';

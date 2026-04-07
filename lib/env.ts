export type AppEnv = 'production' | 'test';

// Simplificado: lê apenas da variável de ambiente
export const getAppEnv = (): AppEnv => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('NEXT_PUBLIC_APP_ENV');
    if (stored) return stored as AppEnv;
  }
  return (process.env.NEXT_PUBLIC_APP_ENV as AppEnv) || 'production';
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

// Helpers mantidos para compatibilidade com o UI
export const getIsProduction = () => getAppEnv() === 'production';
export const getIsTest = () => getAppEnv() === 'test';
export const getEnvName = () => getAppEnv() === 'production' ? 'Ambiente de Produção' : 'Ambiente de Testes';
export const getEnvColor = () => getAppEnv() === 'production' ? 'indigo' : 'amber';

'use client';

import { useState, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { ModuleHeader } from '@/components/ModuleHeader'
import { 
  Settings, 
  Palette, 
  Database, 
  Shield, 
  Webhook, 
  Activity, 
  FileCheck, 
  Upload,
  Search,
  ChevronRight,
  Server,
  Target,
  Megaphone,
  Lock
} from 'lucide-react';

import { SettingsSkeleton } from '@/components/settings/SettingsSkeleton';
import { useAuth } from '@/lib/auth';
import { removeAccents } from '@/lib/utils';

const GeneralTab = lazy(() => import('@/components/settings/GeneralTab').then(m => ({ default: m.GeneralTab })));
const AppearanceTab = lazy(() => import('@/components/settings/AppearanceTab').then(m => ({ default: m.AppearanceTab })));
const DataBackupTab = lazy(() => import('@/components/settings/DataBackupTab').then(m => ({ default: m.DataBackupTab })));
const SecurityAccessTab = lazy(() => import('@/components/settings/SecurityAccessTab').then(m => ({ default: m.SecurityAccessTab })));
const ProfilesTab = lazy(() => import('@/components/settings/ProfilesTab').then(m => ({ default: m.ProfilesTab })));
const IntegrationsApiTab = lazy(() => import('@/components/settings/IntegrationsApiTab').then(m => ({ default: m.IntegrationsApiTab })));
const AuditLogsTab = lazy(() => import('@/components/settings/AuditLogsTab').then(m => ({ default: m.AuditLogsTab })));
const CompliancePrivacyTab = lazy(() => import('@/components/settings/CompliancePrivacyTab').then(m => ({ default: m.CompliancePrivacyTab })));
const DataImportTab = lazy(() => import('@/components/settings/DataImportTab').then(m => ({ default: m.DataImportTab })));
const SystemTab = lazy(() => import('@/components/settings/SystemTab').then(m => ({ default: m.SystemTab })));
const GoalsTab = lazy(() => import('@/components/settings/GoalsTab').then(m => ({ default: m.GoalsTab })));
const MarketingTab = lazy(() => import('@/components/settings/MarketingTab').then(m => ({ default: m.MarketingTab })));
const TrustedDevicesTab = lazy(() => import('@/components/settings/TrustedDevicesTab').then(m => ({ default: m.TrustedDevicesTab })));

const tabs = [
  { id: 'general', name: 'Geral', icon: Settings, component: GeneralTab },
  { id: 'appearance', name: 'Aparência', icon: Palette, component: AppearanceTab },
  { id: 'goals', name: 'Metas & Objetivos', icon: Target, component: GoalsTab },
  { id: 'marketing', name: 'Marketing & Relacionamento', icon: Megaphone, component: MarketingTab },
  { id: 'profiles', name: 'Perfis e Permissões', icon: Shield, component: ProfilesTab },
  { id: 'data', name: 'Gestão de Dados & Backup', icon: Database, component: DataBackupTab },
  { id: 'security', name: 'Segurança & Acessos', icon: Lock, component: SecurityAccessTab },
  { id: 'trusted_devices', name: 'Dispositivos Confiáveis', icon: Shield, component: TrustedDevicesTab },
  { id: 'integrations', name: 'Integrações & API', icon: Webhook, component: IntegrationsApiTab },
  { id: 'audit', name: 'Auditoria (Logs)', icon: Activity, component: AuditLogsTab },
  { id: 'compliance', name: 'Conformidade (LGPD)', icon: FileCheck, component: CompliancePrivacyTab },
  { id: 'import', name: 'Importação de Dados', icon: Upload, component: DataImportTab },
  { id: 'system', name: 'Sistema / Banco de Dados', icon: Server, component: SystemTab },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [searchQuery, setSearchQuery] = useState('');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user?.canAccessSettings && !user?.canAccessUsers && !user?.canAccessTestEnv) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Shield className="h-16 w-16 text-slate-300" />
        <h1 className="text-2xl font-bold text-slate-900">Acesso Negado</h1>
        <p className="text-slate-500">Você não tem permissão para acessar as configurações do sistema.</p>
        <button 
          onClick={() => router.push('/')}
          className="text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Voltar para o Dashboard
        </button>
      </div>
    );
  }

  const filteredTabs = tabs.filter(tab => 
    removeAccents(tab.name.toLowerCase()).includes(removeAccents(searchQuery).toLowerCase())
  );

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || GeneralTab;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <nav className="flex items-center text-sm text-slate-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
          <ChevronRight className="h-4 w-4 mx-2 text-slate-400" />
          <span className="font-medium text-slate-900">Configurações</span>
          {activeTab !== 'general' && (
            <>
              <ChevronRight className="h-4 w-4 mx-2 text-slate-400" />
              <span className="font-medium text-indigo-600">
                {tabs.find(t => t.id === activeTab)?.name}
              </span>
            </>
          )}
        </nav>
      </div>

      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <ModuleHeader 
            icon={Settings}
            title="Configurações do Sistema" 
            description="Gerencie preferências, segurança, integrações e dados da plataforma."
          />
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <div className="relative rounded-md shadow-sm max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 px-3 border bg-white"
              placeholder="Buscar configurações... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {filteredTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center px-3 py-2 text-sm font-medium transition-colors border-l-2
                    ${isActive 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-600' 
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                    }
                  `}
                >
                  <tab.icon
                    className={`
                      flex-shrink-0 -ml-1 mr-3 h-5 w-5
                      ${isActive ? 'text-indigo-600' : 'text-slate-600 group-hover:text-indigo-600'}
                    `}
                    aria-hidden="true"
                  />
                  <span className="truncate">{tab.name}</span>
                </button>
              );
            })}
            {filteredTabs.length === 0 && (
              <p className="text-sm text-slate-500 px-3 py-2">Nenhuma configuração encontrada.</p>
            )}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<SettingsSkeleton />}>
                <ActiveComponent />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

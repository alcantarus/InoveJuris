'use client';

import React from 'react';
import { Users, UserMinus, UserCheck, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { usePrivacy } from '@/components/providers/PrivacyProvider';
import { cn } from '@/lib/utils';

interface Client {
  id: number
  name: string
  email: string
  phone: string
  address: string
  addressNumber: string
  addressComplement: string
  neighborhood: string
  city: string
  uf: string
  cep: string
  status: string
  type: string
  document: string | null
  inssPassword?: string
  civilStatus?: string
  profession?: string
  birthDate?: string | null
  pisNisNit?: string | null
  contractSigned: boolean
  proxySigned: boolean
  isMinor: boolean
  legalRepresentative?: string
}

export function ClientStatsWidget({ 
  clients, 
  onFilterChange, 
  selectedFilter 
}: { 
  clients: Client[], 
  onFilterChange: (filter: string | null) => void,
  selectedFilter: string | null
}) {
  const { isVisible, toggleVisibility } = usePrivacy();
  
  const total = clients.length;
  const minors = clients.filter(c => c.isMinor).length;
  const assisted = clients.filter(c => c.legalRepresentative).length;
  
  // Health score: % of clients with name, email, and document
  const healthScore = total > 0 ? Math.round((clients.filter(c => c.name && c.email && c.document).length / total) * 100) : 0;

  const stats = [
    { id: 'total', label: 'Total Clientes', value: total, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'minors', label: 'Menores de Idade', value: minors, icon: UserMinus, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'assisted', label: 'Assistidos', value: assisted, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'health', label: 'Saúde do Cadastro', value: `${healthScore}%`, icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => (
        <div 
          key={stat.id} 
          className={cn(
            "bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4 cursor-pointer transition-all",
            selectedFilter === stat.id ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 hover:shadow-md"
          )}
          onClick={() => onFilterChange(selectedFilter === stat.id ? null : stat.id)}
        >
          <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
            <stat.icon size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <button 
                onClick={(e) => { e.stopPropagation(); toggleVisibility(stat.label); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {isVisible(stat.label) ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {isVisible(stat.label) ? stat.value : '••••••'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

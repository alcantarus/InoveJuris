'use client';

import React from 'react';
import { Users, UserMinus, UserCheck, ShieldAlert } from 'lucide-react';

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

export function ClientStatsWidget({ clients }: { clients: Client[] }) {
  const total = clients.length;
  const minors = clients.filter(c => c.isMinor).length;
  const assisted = clients.filter(c => c.legalRepresentative).length;
  
  // Simple health score: 100% if all required fields are present
  // For now, let's just use a placeholder calculation
  const healthScore = total > 0 ? Math.round((clients.filter(c => c.name && c.email && c.document).length / total) * 100) : 0;

  const stats = [
    { label: 'Total Clientes', value: total, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Menores de Idade', value: minors, icon: UserMinus, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Assistidos', value: assisted, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Saúde do Cadastro', value: `${healthScore}%`, icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
            <stat.icon size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

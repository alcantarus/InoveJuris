import React from 'react';
import { Modal } from '@/components/Modal';
import { X, Mail, Phone, MapPin, User, FileText, AlertTriangle } from 'lucide-react';

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

interface ClientSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
}

export const ClientSlideOver: React.FC<ClientSlideOverProps> = ({ isOpen, onClose, client }) => {
  if (!client) return null;

  // Calculate health score (dummy logic for now)
  const healthScore = (client.email ? 25 : 0) + (client.document ? 25 : 0) + (client.phone ? 25 : 0) + (client.address ? 25 : 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resumo do Cliente" className="max-w-2xl">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl">
            {client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{client.name}</h2>
            <p className="text-slate-500">{client.type}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-sm text-slate-500">Status</p>
            <p className="font-semibold text-slate-900">{client.status}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-sm text-slate-500">Saúde do Cadastro</p>
            <p className="font-semibold text-indigo-600">{healthScore}%</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-slate-700">
            <Mail size={20} className="text-indigo-500" />
            <span>{client.email}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-700">
            <Phone size={20} className="text-indigo-500" />
            <span>{client.phone}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-700">
            <MapPin size={20} className="text-indigo-500" />
            <span>{client.address}, {client.addressNumber} - {client.neighborhood}, {client.city}/{client.uf}</span>
          </div>
        </div>
        
        {client.legalRepresentative && (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
            <User size={20} className="text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">Assistido por:</p>
              <p className="text-sm text-blue-700">{client.legalRepresentative}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

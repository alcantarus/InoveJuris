import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Shield, Trash2, Smartphone, Monitor, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface TrustedDevice {
  id: string;
  device_name: string;
  user_agent: string;
  ip_address: string;
  location: string;
  trusted_at: string;
  last_used_at: string;
}

export function TrustedDevicesTab() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        if (!user) {
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from('trusted_devices')
          .select('*')
          .eq('user_id', user.id)
          .order('last_used_at', { ascending: false });

        if (error) {
          // Se a tabela não existir, não faz nada
          if (error.code !== '42P01') {
            console.error('Error fetching trusted devices:', error);
          }
        } else {
          setDevices(data || []);
        }
      } catch (e) {
        console.error('Error fetching trusted devices:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
  }, [user]);

  const handleRemoveDevice = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este dispositivo? Você precisará confirmar sua identidade no próximo acesso.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setDevices(prev => prev.filter(d => d.id !== id));
      toast.success('Dispositivo removido com sucesso.');
    } catch (e) {
      console.error('Error removing device:', e);
      toast.error('Erro ao remover dispositivo.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-slate-900">Dispositivos Confiáveis</h3>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie os dispositivos que você marcou como confiáveis. Acessos a partir destes dispositivos não exigirão verificação adicional.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertCircle className="text-amber-500 shrink-0" size={20} />
        <div className="text-sm text-amber-800">
          <p className="font-medium">Atenção</p>
          <p className="mt-1">
            Para que esta funcionalidade funcione completamente, você precisa rodar o script SQL para criar a tabela <code>trusted_devices</code> no Supabase.
          </p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        {devices.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-sm font-medium text-slate-900">Nenhum dispositivo confiável</h3>
            <p className="mt-1 text-sm text-slate-500">
              Você ainda não marcou nenhum dispositivo como confiável.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {devices.map((device) => {
              const isMobile = device.device_name.toLowerCase().includes('mobile') || device.device_name.toLowerCase().includes('iphone') || device.device_name.toLowerCase().includes('android');
              return (
                <li key={device.id} className="p-4 sm:px-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                        {isMobile ? <Smartphone size={24} /> : <Monitor size={24} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{device.device_name}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                          <p className="text-xs text-slate-500">
                            IP: {device.ip_address}
                          </p>
                          <p className="text-xs text-slate-500">
                            Local: {device.location}
                          </p>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Último acesso: {formatDate(device.last_used_at)}
                        </p>
                      </div>
                    </div>
                    <div className="ml-4 shrink-0">
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remover dispositivo"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

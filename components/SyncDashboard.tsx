'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getAppEnv } from '@/lib/env';

const SyncCardField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
    <div className="text-sm text-slate-600 break-words min-w-0 mt-0.5">{children}</div>
  </div>
);

const SyncStatusBadge = ({ status }: { status: string }) => (
  <span className={`px-2 py-1 rounded-full text-xs ${
    status === 'Sincronizado' ? 'bg-green-100 text-green-800' :
    status === 'Erro' ? 'bg-red-100 text-red-800' :
    'bg-yellow-100 text-yellow-800'
  }`}>
    {status === 'Sincronizado' ? '🟢' : status === 'Erro' ? '🔴' : '🟡'} {status}
  </span>
);

async function syncProcess(process_id: number, process_number: string) {
  try {
    const response = await fetch('/api/process-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ process_id, process_number })
    });
    const data = await response.json();

    if (response.ok && data.success) {
      alert(`Sincronização concluída: ${data.movements} andamento(s) atualizado(s).`);
      window.location.reload();
    } else {
      alert(`Erro ao sincronizar: ${data.error || 'Erro desconhecido'}`);
    }
  } catch {
    alert('Erro de comunicação com a API de sincronização.');
  }
}

export default function SyncDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentEnv = getAppEnv();

  useEffect(() => {
    async function fetchData() {
      let result = await supabase
        .from('process_sync_log')
        .select('*')
        .eq('environment', currentEnv);

      // Bancos que ainda não receberam a migration não têm a coluna environment.
      if (result.error && String(result.error.message).includes('environment')) {
        result = await supabase.from('process_sync_log').select('*');
      }

      const { data, error } = result;

      if (error) {
        setLoadError(error.message);
        setData([]);
      } else {
        setLoadError(null);
        setData(data || []);
      }
      setLoading(false);
    }
    fetchData();
  }, [currentEnv]);

  if (loading) return <div>Carregando status de sincronização...</div>;

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-bold mb-4">Status de Sincronização DataJUD</h2>
      {loadError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          Não foi possível carregar o status: {loadError}
        </div>
      )}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Processo</th>
              <th className="p-2">Status</th>
              <th className="p-2">Última Sincronização</th>
              <th className="p-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.process_id} className="border-b">
                <td className="p-2">{item.process_number}</td>
                <td className="p-2"><SyncStatusBadge status={item.sync_status} /></td>
                <td className="p-2">{item.last_sync ? new Date(item.last_sync).toLocaleString() : 'Nunca'}</td>
                <td className="p-2">
                  <button 
                    onClick={() => syncProcess(item.process_id, item.process_number)}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-md text-xs hover:bg-indigo-700"
                  >
                    Sincronizar Agora
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden divide-y divide-slate-100">
        {data.map((item) => (
          <div key={item.process_id} className="p-4 space-y-3">
            <SyncCardField label="Processo">
              <span className="font-medium text-slate-900 break-all">{item.process_number}</span>
            </SyncCardField>
            <SyncCardField label="Status"><SyncStatusBadge status={item.sync_status} /></SyncCardField>
            <SyncCardField label="Última Sincronização">
              <span className="break-words">{item.last_sync ? new Date(item.last_sync).toLocaleString() : 'Nunca'}</span>
            </SyncCardField>
            <SyncCardField label="Ação">
              <button
                onClick={() => syncProcess(item.process_id, item.process_number)}
                className="px-3 py-2 min-h-[40px] bg-indigo-600 text-white rounded-md text-xs hover:bg-indigo-700"
              >
                Sincronizar Agora
              </button>
            </SyncCardField>
          </div>
        ))}
      </div>
    </div>
  );
}

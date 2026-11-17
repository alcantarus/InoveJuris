'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { defaultUrlProd, defaultKeyProd } from '@/lib/supabase';
import { getAppEnv } from '@/lib/env';

const supabase = createClient(
  defaultUrlProd,
  defaultKeyProd
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
        .from('process_sync_status')
        .select('*')
        .eq('environment', currentEnv);

      // Bancos que ainda não receberam a migration não têm a coluna environment.
      if (result.error && String(result.error.message).includes('environment')) {
        result = await supabase.from('process_sync_status').select('*');
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
              <td className="p-2">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  item.sync_status === 'Sincronizado' ? 'bg-green-100 text-green-800' :
                  item.sync_status === 'Erro' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {item.sync_status === 'Sincronizado' ? '🟢' : item.sync_status === 'Erro' ? '🔴' : '🟡'} {item.sync_status}
                </span>
              </td>
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
  );
}

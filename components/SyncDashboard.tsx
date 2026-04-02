'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { defaultUrlProd, defaultKeyProd } from '@/lib/supabase';

// Inicializa o cliente Supabase
const supabase = createClient(
  defaultUrlProd,
  defaultKeyProd
);

export default function SyncDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Função de sincronização atualizada para chamar a Edge Function do Supabase
  async function syncProcess(process_id: number, process_number: string) {
    console.log(">>> [DEBUG] syncProcess iniciada para:", process_number);
    
    try {
      console.log(">>> [DEBUG] Chamando Edge Function do Supabase...");
      
      // Chamada direta para a Edge Function do Supabase
      const response = await fetch(`${defaultUrlProd}/functions/v1/datajud-sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${defaultKeyProd}`
        },
        body: JSON.stringify({ process_id, process_number })
      });
      
      console.log(">>> [DEBUG] Resposta da Edge Function recebida, status:", response.status);
      
      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success) {
        console.log(">>> [DEBUG] Sincronização iniciada com sucesso!");
        alert('Sincronização iniciada com sucesso!');
        window.location.reload();
      } else {
        console.error(">>> [DEBUG] Erro na resposta da Edge Function:", result);
        alert(`Erro ao iniciar sincronização: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error(">>> [DEBUG] Erro fatal na comunicação:", error);
      alert('Erro na comunicação com a API de sincronização.');
    }
  }

  useEffect(() => {
    async function fetchData() {
      console.log(">>> [DEBUG] Buscando dados do Supabase...");
      const { data, error } = await supabase
        .from('process_sync_status')
        .select('*');
      
      if (error) {
        console.error(">>> [DEBUG] Erro ao buscar dados:", error);
      } else {
        console.log(">>> [DEBUG] Dados recebidos:", data);
        if (data) setData(data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <div>Carregando status de sincronização...</div>;

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-bold mb-4">Status de Sincronização DataJUD</h2>
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
                  onClick={() => {
                    console.log(">>> [DEBUG] Botão clicado para processo:", item.process_number);
                    syncProcess(item.process_id, item.process_number);
                  }}
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

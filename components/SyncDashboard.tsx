'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SyncDashboard() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('process_sync_status')
        .select('*');
      
      if (data) setData(data);
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

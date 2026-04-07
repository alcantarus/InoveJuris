'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ProductivityChart() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchProductivityData = async () => {
      try {
        const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !supabaseUser) {
          if (isMounted) setLoading(false);
          return;
        }

        // Get tasks from the last 7 days
        const sevenDaysAgo = subDays(new Date(), 7).toISOString().split('T')[0];
        
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('status, created_at, due_date')
          .eq('user_id', supabaseUser.id)
          .gte('created_at', sevenDaysAgo);

        if (!isMounted) return;

        if (error) {
          console.error('Error fetching productivity data:', error);
          setLoading(false);
          return;
        }

        // Process data by day
        const daysMap = new Map();
        
        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
          const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
          daysMap.set(date, {
            date: format(subDays(new Date(), i), 'dd/MM', { locale: ptBR }),
            concluidas: 0,
            pendentes: 0
          });
        }

        // Populate with actual data
        (tasks as any[])?.forEach(task => {
          const dateKey = task.created_at.split('T')[0];
          if (daysMap.has(dateKey)) {
            const dayData = daysMap.get(dateKey);
            if (task.status === 'completed') {
              dayData.concluidas += 1;
            } else {
              dayData.pendentes += 1;
            }
          }
        });

        if (isMounted) {
          setData(Array.from(daysMap.values()));
        }
      } catch (err: any) {
        console.error('Unexpected error fetching productivity data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProductivityData();
    return () => { isMounted = false; };
  }, [user]);

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-6">Produtividade (Últimos 7 Dias)</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorConcluidas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPendentes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
            <Area 
              type="monotone" 
              dataKey="concluidas" 
              name="Concluídas"
              stroke="#10b981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorConcluidas)" 
            />
            <Area 
              type="monotone" 
              dataKey="pendentes" 
              name="Pendentes"
              stroke="#f59e0b" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPendentes)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

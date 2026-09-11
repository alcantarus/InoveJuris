
import React from 'react';
import { AlertTriangle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

interface ProcessDeadline {
  id: number;
  process_number: string;
  client_name: string;
  deadline_date: string;
}

interface DeadlineAlertCardProps {
  deadlines: ProcessDeadline[];
}

export const DeadlineAlertCard: React.FC<DeadlineAlertCardProps> = ({ deadlines }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const processedDeadlines = deadlines.map(d => {
    const deadline = new Date(d.deadline_date);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { ...d, diffDays };
  });

  const buckets = {
    critical: processedDeadlines.filter(d => d.diffDays <= 1),
    urgent: processedDeadlines.filter(d => d.diffDays > 1 && d.diffDays <= 7),
    warning: processedDeadlines.filter(d => d.diffDays > 7 && d.diffDays <= 15),
    info: processedDeadlines.filter(d => d.diffDays > 15 && d.diffDays <= 30),
  };

  if (deadlines.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <AlertTriangle className="text-amber-500" size={20} />
        Prazos Próximos
      </h3>
      
      <div className="space-y-3">
        {buckets.critical.map(d => (
          <motion.div 
            key={d.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between animate-pulse"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="text-rose-600" size={20} />
              <div>
                <p className="text-sm font-bold text-rose-900">{d.process_number}</p>
                <p className="text-xs text-rose-700">{d.client_name}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded-full">HOJE/AMANHÃ</span>
          </motion.div>
        ))}

        {buckets.urgent.map(d => (
          <div key={d.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="text-amber-600" size={20} />
              <div>
                <p className="text-sm font-bold text-amber-900">{d.process_number}</p>
                <p className="text-xs text-amber-700">{d.client_name}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-700">{d.diffDays} dias</span>
          </div>
        ))}

        {buckets.warning.map(d => (
          <div key={d.id} className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="text-blue-600" size={20} />
              <div>
                <p className="text-sm font-bold text-blue-900">{d.process_number}</p>
                <p className="text-xs text-blue-700">{d.client_name}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700">{d.diffDays} dias</span>
          </div>
        ))}
      </div>
    </div>
  );
};

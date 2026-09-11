import React from 'react';
import { cn } from '@/lib/utils';

interface ActionableItem {
  id: string | number;
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
}

interface ActionableDashboardCardProps {
  title: string;
  items: ActionableItem[];
  emptyMessage: string;
  icon: React.ElementType;
  className?: string;
}

export const ActionableDashboardCard: React.FC<ActionableDashboardCardProps> = ({
  title,
  items,
  emptyMessage,
  icon: Icon,
  className
}) => {
  return (
    <div className={cn("bg-white p-6 rounded-3xl border border-slate-200 shadow-sm", className)}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
          <Icon size={20} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      </div>
      
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 italic">{emptyMessage}</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.subtitle}</p>
              </div>
              <button 
                onClick={item.onAction}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {item.actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

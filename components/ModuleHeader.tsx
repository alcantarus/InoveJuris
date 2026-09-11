import React from 'react';
import { LucideIcon, Wallet } from 'lucide-react';

interface ModuleHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export const ModuleHeader = ({ title, description, icon: Icon = Wallet, action }: ModuleHeaderProps) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          {Icon && (
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Icon size={24} />
            </div>
          )}
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        </div>
        <p className="text-slate-600">{description}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ModuleHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const ModuleHeader = ({ title, description, icon: Icon }: ModuleHeaderProps) => {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-start sm:items-center gap-3 mb-2">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
          <Icon size={24} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight break-words">{title}</h1>
      </div>
      <p className="text-slate-600 text-sm sm:text-base">{description}</p>
    </div>
  );
};

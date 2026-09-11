import { ReactNode } from 'react';

interface CardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  danger?: boolean;
}

export function Card({ title, description, children, footer, danger = false }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm ring-1 ${danger ? 'ring-red-200' : 'ring-slate-200'} overflow-hidden`}>
      <div className={`px-6 py-5 border-b ${danger ? 'border-red-100 bg-red-50/30' : 'border-slate-100'}`}>
        <h3 className={`text-lg font-medium leading-6 ${danger ? 'text-red-700' : 'text-slate-900'}`}>{title}</h3>
        {description && <p className={`mt-1 text-sm ${danger ? 'text-red-600/80' : 'text-slate-600'}`}>{description}</p>}
      </div>
      <div className="px-6 py-5">
        {children}
      </div>
      {footer && (
        <div className={`px-6 py-4 bg-slate-50 border-t ${danger ? 'border-red-100' : 'border-slate-100'}`}>
          {footer}
        </div>
      )}
    </div>
  );
}

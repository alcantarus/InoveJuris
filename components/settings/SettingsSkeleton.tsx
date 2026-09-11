import React from 'react';

export const SettingsSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-8 bg-slate-200 rounded w-1/3"></div>
    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="h-24 bg-slate-100 rounded-xl"></div>
      <div className="h-24 bg-slate-100 rounded-xl"></div>
      <div className="h-24 bg-slate-100 rounded-xl"></div>
      <div className="h-24 bg-slate-100 rounded-xl"></div>
    </div>
  </div>
);

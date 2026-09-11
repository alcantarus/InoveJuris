'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Palette, Sun, UploadCloud, CheckCircle2 } from 'lucide-react';
import { useSettings } from '@/components/providers/SettingsProvider';

export function AppearanceTab() {
  const { settings, updateSetting } = useSettings();
  const [primaryColor, setPrimaryColor] = useState(settings.appearance?.primary_color || 'indigo');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setPrimaryColor(settings.appearance?.primary_color || 'indigo');
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSetting('appearance', {
        theme: 'light',
        primary_color: primaryColor
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save appearance settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Tema do Sistema"
        description="O sistema está configurado para utilizar o tema claro."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div 
            className="border rounded-lg p-4 flex flex-col items-center border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600"
          >
            <Sun className="h-8 w-8 mb-2 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-900">Claro</span>
          </div>
        </div>
      </Card>

      <Card
        title="Identidade Visual (White-label)"
        description="Personalize o logotipo e as cores primárias do sistema."
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Logotipo da Empresa</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md hover:border-indigo-400 transition-colors cursor-pointer">
              <div className="space-y-1 text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-slate-600" />
                <div className="flex text-sm text-slate-600 justify-center">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                    <span>Fazer upload de um arquivo</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" />
                  </label>
                  <p className="pl-1">ou arraste e solte</p>
                </div>
                <p className="text-xs text-slate-600">PNG, JPG, GIF até 2MB</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Cor Primária</label>
            <div className="flex items-center space-x-3">
              {[
                { name: 'indigo', color: 'bg-indigo-600' },
                { name: 'emerald', color: 'bg-emerald-600' },
                { name: 'rose', color: 'bg-rose-600' },
                { name: 'amber', color: 'bg-amber-500' },
                { name: 'slate', color: 'bg-slate-900' },
              ].map((color) => (
                <div 
                  key={color.name}
                  onClick={() => setPrimaryColor(color.name)}
                  className={`w-10 h-10 rounded-full ${color.color} cursor-pointer hover:scale-110 transition-transform ${primaryColor === color.name ? 'ring-2 ring-offset-2 ring-indigo-600' : ''}`}
                ></div>
              ))}
              <div className="w-10 h-10 rounded-full border border-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-50">
                <Palette className="h-4 w-4 text-slate-600" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {showSuccess && (
          <span className="flex items-center text-sm text-emerald-600 animate-in fade-in slide-in-from-right-2">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Configurações salvas!
          </span>
        )}
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useSettings } from '@/components/providers/SettingsProvider';
import { toast } from 'sonner';

export function LogoUpload() {
  const { settings, updateSetting } = useSettings();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateSetting('office_logo', base64String);
        toast.success('Logomarca atualizada com sucesso!');
      } catch (error) {
        console.error('Error saving logo:', error);
        toast.error(`Erro ao salvar logomarca: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">Logomarca do Escritório</label>
      <div className="flex items-center gap-4">
        {settings.office_logo ? (
          <div className="relative w-24 h-24 border rounded-lg overflow-hidden">
            <Image 
              src={settings.office_logo} 
              alt="Logo" 
              width={96} 
              height={96} 
              className="w-full h-full object-contain" 
              referrerPolicy="no-referrer"
            />
            <button
              onClick={() => updateSetting('office_logo', '')}
              className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400">
            <Upload size={24} />
          </div>
        )}
        <label className="cursor-pointer px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700">
          {isUploading ? <Loader2 className="animate-spin" size={16} /> : 'Alterar Logomarca'}
          <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        </label>
      </div>
    </div>
  );
}

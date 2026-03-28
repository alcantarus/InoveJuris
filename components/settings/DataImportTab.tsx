'use client';

import { useState } from 'react';
import { Card } from '../ui/Card';
import { UploadCloud, FileArchive, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function DataImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/backup/restore', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha na importação');
      }

      setResults(data.results);
      toast.success('Importação concluída com sucesso!');
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Erro ao importar dados');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Importação e Restauração de Dados"
        description="Restaure um backup do sistema (.zip) ou importe dados compatíveis."
      >
        <div className="space-y-8">
          {/* Step 1: Upload */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-start">
              <span className="pr-3 bg-white text-lg font-medium text-slate-900">
                1. Selecionar Arquivo de Backup
              </span>
            </div>
          </div>

          <div className="mt-4 flex justify-center px-6 pt-5 pb-6 border-2 border-indigo-300 border-dashed rounded-md bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer">
            <div className="space-y-1 text-center">
              {file ? (
                <FileArchive className="mx-auto h-12 w-12 text-indigo-500" />
              ) : (
                <UploadCloud className="mx-auto h-12 w-12 text-indigo-500" />
              )}
              <div className="flex text-sm text-slate-600 justify-center">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-transparent rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                  <span>{file ? file.name : 'Selecionar arquivo ZIP'}</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".zip,.json" onChange={handleFileChange} />
                </label>
                {!file && <p className="pl-1">ou arraste para cá</p>}
              </div>
              <p className="text-xs text-slate-600">Suporta arquivos .zip gerados pelo backup do sistema.</p>
            </div>
          </div>

          {file && !results && (
            <div className="flex justify-end">
              <button
                onClick={handleImport}
                disabled={uploading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Processando...
                  </>
                ) : (
                  'Iniciar Restauração'
                )}
              </button>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-start">
                  <span className="pr-3 bg-white text-lg font-medium text-slate-900">
                    2. Resultado da Importação
                  </span>
                </div>
              </div>

              <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-md border border-slate-200">
                <ul role="list" className="divide-y divide-slate-200">
                  {results.map((result, index) => (
                    <li key={index} className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {result.status === 'success' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 mr-3" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
                          )}
                          <p className="text-sm font-medium text-slate-900 truncate">
                            Tabela: <span className="font-bold">{result.table}</span>
                          </p>
                        </div>
                        <div className="ml-2 flex-shrink-0 flex">
                          <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            result.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {result.status === 'success' ? `${result.count} registros` : 'Erro'}
                          </p>
                        </div>
                      </div>
                      {result.message && (
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-slate-500">
                              {result.message}
                            </p>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';
import { defaultUrlProd, defaultKeyProd } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    const cookieStore = await cookies();
    const appEnv = cookieStore.get('app_env')?.value || 'production';
    const supabase = createClient(defaultUrlProd, defaultKeyProd);

    // Define restoration order to respect Foreign Keys (approximate)
    const tableOrder = [
      'users',
      'system_settings',
      'products',
      'clients',
      'sales',
      'financial_records',
      'audit_logs'
    ];

    // Sort entries based on tableOrder
    const sortedEntries = zipEntries.sort((a, b) => {
      const tableA = a.name.replace('.json', '');
      const tableB = b.name.replace('.json', '');
      const indexA = tableOrder.indexOf(tableA);
      const indexB = tableOrder.indexOf(tableB);
      // If not in list, put at the end
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    const results = [];

    for (const entry of sortedEntries) {
      if (!entry.name.endsWith('.json') || entry.name.includes('_error.json')) continue;

      const tableName = entry.name.replace('.json', '');
      const fileContent = entry.getData().toString('utf8');
      
      try {
        let data = JSON.parse(fileContent);

        if (Array.isArray(data) && data.length > 0) {
          // Perform Upsert
          const { error } = await supabase.from(tableName).upsert(data);
          
          if (error) {
            console.error(`Error restoring ${tableName}:`, error);
            results.push({ table: tableName, status: 'error', message: error.message });
          } else {
            results.push({ table: tableName, status: 'success', count: data.length });
          }
        } else {
            results.push({ table: tableName, status: 'skipped', message: 'No data or invalid format' });
        }

      } catch (e: any) {
        console.error(`Error parsing ${tableName}:`, e);
        results.push({ table: tableName, status: 'error', message: e.message });
      }
    }

    return NextResponse.json({ message: 'Importação concluída', results });

  } catch (error: any) {
    console.error('Restore Error:', error);
    return NextResponse.json({ error: error.message || 'Falha na importação' }, { status: 500 });
  }
}

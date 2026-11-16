import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Connection Status
    const { data: connectionData, error: connectionError } = await supabase
      .from('system_settings')
      .select('key')
      .limit(1);
    
    const isConnected = !connectionError;

    // 2. Database Name
    // Supabase doesn't easily expose the DB name via standard client.
    // We can assume it's the project ID or something from config.
    const dbName = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : 'Unknown';

    // 3. Database Size
    // This requires a raw SQL query which might not be supported by the anon key.
    // Let's try it.
    const { data: sizeData, error: sizeError } = await supabase.rpc('get_db_size');
    
    const dbSize = sizeError ? 'N/A' : sizeData;

    return NextResponse.json({
      name: dbName,
      size: dbSize,
      isConnected,
      lastBackupDate: null // We will fetch this from system_settings in the frontend
    });
  } catch (error: any) {
    console.error('Error fetching DB status:', error);
    return NextResponse.json({ error: 'Falha ao buscar status do banco' }, { status: 500 });
  }
}

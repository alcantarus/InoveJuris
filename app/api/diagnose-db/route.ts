import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const { error, data } = await supabase.rpc('exec_sql', {
           sql: 'SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = \'leads\' AND column_name = \'status\';'
        });
        console.log("Diagnóstico da coluna status:", { error, data });
        return NextResponse.json({ error, data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}

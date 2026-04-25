import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const { error, data } = await supabase.rpc('exec_sql', {
           sql: 'ALTER TYPE lead_status ADD VALUE IF NOT EXISTS \'Em Atendimento\';'
        });
        if (error) {
            console.error("SQL Error:", error);
        }
        console.log("Resultado da correção de banco:", { error, data });
        return NextResponse.json({ error, data });
    } catch (e: any) {
        console.error("Erro fatal no fix-db:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

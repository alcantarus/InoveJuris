import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const { error, data } = await supabase.rpc('exec_sql', {
           sql: `
            ALTER TABLE leads ALTER COLUMN status TYPE TEXT USING status::text;
            DROP TYPE IF EXISTS lead_status CASCADE;
           `
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

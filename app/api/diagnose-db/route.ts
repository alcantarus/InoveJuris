import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const sql = `
            SELECT 
                objid::regclass AS dependent_table,
                objsubid,
                deptype
            FROM pg_depend
            WHERE refobjid = 'lead_status'::regtype;
        `;
        
        const { error, data } = await supabase.rpc('exec_sql', { sql });
        console.log("Dependências do enum lead_status:", { error, data });
        return NextResponse.json({ error, data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

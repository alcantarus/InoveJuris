import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        // Query to get all enum values for lead_status
        const sql = `
            SELECT 
                n.nspname AS enum_schema,  
                t.typname AS enum_name,  
                e.enumlabel AS enum_value
            FROM pg_type t 
            JOIN pg_enum e ON t.oid = e.enumtypid  
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            WHERE t.typname = 'lead_status';
        `;
        
        const { error, data } = await supabase.rpc('exec_sql', { sql });
        console.log("Enum values for lead_status:", { error, data });
        return NextResponse.json({ error, data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

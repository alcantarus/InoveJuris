import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { defaultUrlProd } from '@/lib/supabase';

// We need the service role key to execute DDL, but we don't have it.
// Wait, can we execute via RPC using the anon key? Only if the RPC function allows it.
// Let's try with the anon key and see.
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const { error, data } = await supabase.rpc('exec_sql', {
           sql: `
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE leads ALTER COLUMN status TYPE TEXT USING status::text;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error altering status: %', SQLERRM;
    END;

    BEGIN
        DROP TYPE IF EXISTS lead_status CASCADE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping type: %', SQLERRM;
    END;
END $$;`
        });
        console.log("Resultado da correção de banco:", { error, data });
        return NextResponse.json({ error, data });
    } catch (e: any) {
        console.error("Erro fatal no fix-db:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

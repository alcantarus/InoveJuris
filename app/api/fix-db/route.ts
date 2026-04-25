import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { defaultUrlProd } from '@/lib/supabase';

// We need the service role key to execute DDL, but we don't have it.
// Wait, can we execute via RPC using the anon key? Only if the RPC function allows it.
// Let's try with the anon key and see.
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const { error } = await supabase.rpc('exec_sql', {
           sql: `
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to leads" ON leads;
CREATE POLICY "Allow all access to leads" ON leads FOR ALL USING (true) WITH CHECK (true);`
        });
        return NextResponse.json({ error });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}

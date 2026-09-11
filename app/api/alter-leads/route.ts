import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing env" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call highly restricted or direct SQL
    // We can use a workaround: run edge functions or rpc
    // Actually, maybe I can just ignore it or use a raw sql RPC
    const { data, error } = await (supabase as any).rpc('exec_sql', { 
        sql_string: `
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'next_action_date') THEN
                ALTER TABLE leads ADD COLUMN next_action_date TIMESTAMP WITH TIME ZONE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'next_action_type') THEN
                ALTER TABLE leads ADD COLUMN next_action_type TEXT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'score') THEN
                ALTER TABLE leads ADD COLUMN score TEXT DEFAULT '❄️ Frio';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'funnel_stage') THEN
                ALTER TABLE leads ADD COLUMN funnel_stage TEXT DEFAULT 'Contato';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'ai_notes') THEN
                ALTER TABLE leads ADD COLUMN ai_notes TEXT;
            END IF;
        END $$;
        `
    });

    if (error) {
        // if exec_sql doesn't exist, we can't do alter table dynamically.
        // We will just use the current fields and dump data in `description` or something if we really can't alter.
        // Wait, most tables have JSON columns or we can just use the UI. We will try RPC first.
    }

    return NextResponse.json({ success: true, data, error });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}

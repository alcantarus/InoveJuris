import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        const { error, data } = await supabase.rpc('exec_sql', {
           sql: `
            ALTER TABLE leads ALTER COLUMN status TYPE TEXT USING status::text;
            DROP TYPE IF EXISTS lead_status CASCADE;
            
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'next_action_date') THEN
                    ALTER TABLE leads ADD COLUMN next_action_date TIMESTAMP WITH TIME ZONE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'next_action_type') THEN
                    ALTER TABLE leads ADD COLUMN next_action_type TEXT DEFAULT 'Mensagem';
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
            console.error("SQL Error:", error);
        }
        console.log("Resultado da correção de banco:", { error, data });
        return NextResponse.json({ error, data });
    } catch (e: any) {
        console.error("Erro fatal no fix-db:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { defaultUrlProd, defaultKeyProd } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Datas de início e fim são obrigatórias' }, { status: 400 });
    }

    // Initialize Supabase Client
    const supabase = createClient(defaultUrlProd, defaultKeyProd);

    // Perform deletion
    // We use >= startDate and <= endDate (inclusive)
    // Adjust endDate to end of day if it's just a date string?
    // The frontend usually sends YYYY-MM-DD.
    // So startDate should be YYYY-MM-DD 00:00:00
    // And endDate should be YYYY-MM-DD 23:59:59
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const { error, count } = await supabase
      .from('audit_logs')
      .delete({ count: 'exact' })
      .gte('performed_at', start.toISOString())
      .lte('performed_at', end.toISOString());

    if (error) {
      console.error('Error deleting audit logs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Logs de auditoria excluídos com sucesso', 
      count 
    });

  } catch (error: any) {
    console.error('Audit Cleanup Error:', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao limpar logs de auditoria' },
      { status: 500 }
    );
  }
}

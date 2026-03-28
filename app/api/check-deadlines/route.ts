import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Buscar prazos próximos (ex: 7 dias) que ainda não foram alertados
    const { data: deadlines, error } = await supabase
      .from('process_deadlines')
      .select('*, processes(number, client)')
      .eq('alert_sent', false)
      .lte('deadline_date', new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (error) throw error;

    // 2. Criar notificações e marcar como alertado
    for (const d of deadlines || []) {
      await supabase.from('notifications').insert([{
        title: 'Prazo Próximo',
        message: `O prazo "${d.description}" do processo ${d.processes.number} vence em breve.`,
        type: 'warning',
        user_id: null, // Ajustar conforme necessidade de notificar um usuário específico
        read: false
      }]);

      await supabase.from('process_deadlines').update({ alert_sent: true }).eq('id', d.id);
    }

    return NextResponse.json({ success: true, count: deadlines?.length || 0 });
  } catch (error) {
    console.error('Error checking deadlines:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { authErrorResponse, requireAdminContext } from '@/lib/server-auth';
import { createServiceRoleClient, ServiceRoleConfigError } from '@/lib/supabase-service';

export async function POST(request: Request) {
  try {
    const admin = await requireAdminContext('audit');

    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Datas de início e fim são obrigatórias' }, { status: 400 });
    }

    const appEnv = admin.environment;
    
    // A limpeza apaga audit_logs, cuja escrita foi revogada do anon no
    // F4b-1c1. Usa service_role com falha explicita se a chave faltar.
    const supabase = createServiceRoleClient();

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
      .eq('environment', appEnv)
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
    const unauthorized = authErrorResponse(error);
    if (unauthorized) return unauthorized;

    if (error instanceof ServiceRoleConfigError) {
      console.error('Audit Cleanup Error:', error.message);
      return NextResponse.json(
        { error: 'Servidor sem configuração de escrita.' },
        { status: 500 }
      );
    }

    console.error('Audit Cleanup Error:', error);
    return NextResponse.json(
      { error: error.message || 'Falha ao limpar logs de auditoria' },
      { status: 500 }
    );
  }
}

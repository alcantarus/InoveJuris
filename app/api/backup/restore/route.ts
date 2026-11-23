import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import { authErrorResponse, requireSuperadminContext } from '@/lib/server-auth';
import { createServiceRoleClient, ServiceRoleConfigError } from '@/lib/supabase-service';

/**
 * Restore so aceita tabelas de dados de dominio. Identidade, permissoes,
 * configuracao e auditoria nunca sao sobrescritas por upload de backup.
 * A ordem tambem e a allowlist: uma unica fonte de verdade.
 */
const RESTORE_ORDER = [
  'law_areas',
  'lawyers',
  'diseases',
  'products',
  'product_diseases',
  'indicators',
  'clients',
  'client_tags',
  'client_relationships',
  'client_interactions',
  'client_documents',
  'contracts',
  'contract_diseases',
  'installments',
  'installment_history',
  'payments',
  'commission_payments',
  'bank_accounts',
  'financial_categories',
  'financial_transactions',
  'processes',
  'process_deadlines',
  'process_deadline_history',
  'process_sync_log',
  'publications',
  'publication_sync_log',
  'document_templates',
  'template_variables',
  'tasks',
  'task_history',
  'kanban_boards',
  'kanban_columns',
  'leads',
  'notifications',
  'birthday_templates',
  'birthday_messages',
  'marketing_logs',
  'sales',
  'financial_records',
];

const RESTORE_ALLOWED = new Set(RESTORE_ORDER);

const BLOCKED_TABLES = new Set([
  'users',
  'user_sessions',
  'login_challenges',
  'trusted_devices',
  'roles',
  'permissions',
  'role_permissions',
  'user_roles',
  'system_settings',
  'backup_settings',
  'audit_logs',
  'backup_logs',
  'client_onboarding_tokens',
  'indicator_tokens',
]);

type RestoreResult = {
  table: string;
  status: 'success' | 'error' | 'skipped';
  count?: number;
  message?: string;
};

type SkippedEntry = {
  table: string;
  reason: string;
};

function tableNameFromEntry(name: string): string | null {
  if (!/^[A-Za-z0-9_]+\.json$/i.test(name)) return null;
  return name.slice(0, -'.json'.length);
}

export async function POST(request: Request) {
  try {
    const admin = await requireSuperadminContext();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const zip = new AdmZip(buffer);

    // Restore grava com service_role: falha explicita se a chave nao estiver
    // configurada, sem cair para anon e mascarar o problema.
    const supabase = createServiceRoleClient();

    const entries = zip.getEntries()
      .filter((entry) => !entry.isDirectory && !entry.name.endsWith('_error.json') && tableNameFromEntry(entry.name))
      .sort((a, b) => {
        const indexA = RESTORE_ORDER.indexOf(tableNameFromEntry(a.name)!);
        const indexB = RESTORE_ORDER.indexOf(tableNameFromEntry(b.name)!);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

    const results: RestoreResult[] = [];
    const skipped: SkippedEntry[] = [];

    for (const entry of entries) {
      const tableName = tableNameFromEntry(entry.name)!;

      if (BLOCKED_TABLES.has(tableName)) {
        skipped.push({
          table: tableName,
          reason: 'Tabela protegida: nao pode ser restaurada por upload.',
        });
        continue;
      }

      if (!RESTORE_ALLOWED.has(tableName)) {
        skipped.push({
          table: tableName,
          reason: 'Fora da allowlist de restauracao.',
        });
        continue;
      }

      try {
        const data = JSON.parse(entry.getData().toString('utf8'));

        if (!Array.isArray(data) || data.length === 0) {
          results.push({
            table: tableName,
            status: 'skipped',
            message: 'No data or invalid format',
          });
          continue;
        }

        const { error } = await supabase.from(tableName).upsert(data);

        if (error) {
          console.error(`Error restoring ${tableName}:`, error);
          results.push({ table: tableName, status: 'error', message: error.message });
        } else {
          results.push({ table: tableName, status: 'success', count: data.length });
        }
      } catch (e: any) {
        console.error(`Error parsing ${tableName}:`, e);
        results.push({ table: tableName, status: 'error', message: e.message });
      }
    }

    // Toda restauracao precisa deixar rastro, mesmo quando alguns itens falham.
    let auditLogged = false;
    try {
      const { error: auditError } = await supabase.from('audit_logs').insert([{
        table_name: 'backups',
        action: 'restore',
        performed_by: admin.userId,
        environment: admin.environment,
        new_data: {
          file_name: file.name,
          sha256: fileHash,
          session_id: admin.sessionId,
          restored: results.filter((item) => item.status === 'success').length,
          failed: results.filter((item) => item.status === 'error').length,
          skipped: skipped.length,
        },
      }]);

      if (auditError) throw auditError;
      auditLogged = true;
    } catch (auditError) {
      console.error('Restore: falha ao registrar auditoria:', auditError);
    }

    return NextResponse.json({
      message: 'Importação concluída',
      results,
      skipped,
      audit: auditLogged ? 'registered' : 'failed',
    });

  } catch (error: any) {
    const unauthorized = authErrorResponse(error);
    if (unauthorized) return unauthorized;

    if (error instanceof ServiceRoleConfigError) {
      console.error('Restore Error:', error.message);
      return NextResponse.json(
        { error: 'Servidor sem configuração de service role.' },
        { status: 503 }
      );
    }

    console.error('Restore Error:', error);
    return NextResponse.json({ error: error.message || 'Falha na importação' }, { status: 500 });
  }
}

-- Rollback de EMERGÊNCIA do Bloco 3.
--
-- Restaura o estado permissivo anterior nas tabelas listadas. Isso REABRE o
-- acesso pela chave anon sem token; use apenas para destravar produção e
-- reaplique o lote corretivo logo em seguida.
--
-- Não mexe em Storage, RPCs do Bloco 2 nem nas funções auxiliares.

do $$
declare
  t text;
  policy_names text[] := array[
    'P0 sessao',
    'P0 somente leitura',
    'P0 link onboarding',
    'P0 link indicador',
    'P0 onboarding leitura',
    'P0 onboarding escrita',
    'P0 portal indicador'
  ];
  tables text[] := array[
    'users','roles','permissions','role_permissions','user_roles',
    'law_areas','lawyers','diseases','products','indicators',
    'bank_accounts','financial_categories','product_diseases','contract_diseases',
    'clients','client_tags','client_relationships','client_interactions',
    'client_documents','client_onboarding_tokens',
    'contracts','installments','installment_history','payments',
    'commission_payments','financial_transactions','sales','financial_records',
    'processes','process_deadlines','process_deadline_history','process_sync_log',
    'publications','publication_sync_log','integration_logs','geo_cache',
    'document_templates','template_variables','birthday_templates',
    'birthday_messages','marketing_logs','leads','notifications',
    'tasks','task_history','kanban_boards','kanban_columns',
    'system_settings','audit_logs','indicator_tokens'
  ];
  p text;
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = t
    ) then
      continue;
    end if;

    foreach p in array policy_names loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;

    execute format('drop policy if exists %I on public.%I', 'Permissivo legado', t);
    execute format($f$
      create policy %I on public.%I
        for all to anon, authenticated
        using (true)
        with check (true)
    $f$, 'Permissivo legado', t);
  end loop;
end $$;

-- Observação: user_sessions, login_challenges e trusted_devices não entram
-- na lista. Se algum fluxo interno quebrar, restaurar as policies específicas
-- do backup F4b em C:\InoveTecnologia\InoveJuris-Backups\F4b-20261119\.

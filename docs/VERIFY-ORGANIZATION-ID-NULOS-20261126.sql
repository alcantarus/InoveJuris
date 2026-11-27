-- VERIFY - campos organization_id nulos
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Tipo da coluna: uuid em todas as 42 tabelas verificadas, entao
-- "vazio" so pode significar NULL (nao existe string vazia em uuid).
-- Tabelas historicas de backup removidas em 26/11 ficam de fora.

begin;

with dados as (
  select 'bank_accounts'::text as tabela, coalesce(t.environment::text, 'sem environment') as environment, count(*) as linhas, count(*) filter (where t.organization_id is null) as nulos from public.bank_accounts t group by 1, 2
  union all select 'birthday_messages', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.birthday_messages t group by 1, 2
  union all select 'birthday_templates', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.birthday_templates t group by 1, 2
  union all select 'client_documents', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.client_documents t group by 1, 2
  union all select 'client_interactions', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.client_interactions t group by 1, 2
  union all select 'client_onboarding_tokens', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.client_onboarding_tokens t group by 1, 2
  union all select 'client_tags', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.client_tags t group by 1, 2
  union all select 'clients', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.clients t group by 1, 2
  union all select 'commission_payments', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.commission_payments t group by 1, 2
  union all select 'contracts', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.contracts t group by 1, 2
  union all select 'document_templates', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.document_templates t group by 1, 2
  union all select 'financial_categories', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.financial_categories t group by 1, 2
  union all select 'financial_transactions', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.financial_transactions t group by 1, 2
  union all select 'indicator_tokens', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.indicator_tokens t group by 1, 2
  union all select 'indicators', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.indicators t group by 1, 2
  union all select 'installments', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.installments t group by 1, 2
  union all select 'integration_logs', 'sem environment', count(*), count(*) filter (where t.organization_id is null) from public.integration_logs t
  union all select 'kanban_boards', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.kanban_boards t group by 1, 2
  union all select 'kanban_columns', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.kanban_columns t group by 1, 2
  union all select 'law_areas', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.law_areas t group by 1, 2
  union all select 'lawyers', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.lawyers t group by 1, 2
  union all select 'legal_contract_workflow', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.legal_contract_workflow t group by 1, 2
  union all select 'legal_contracts', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.legal_contracts t group by 1, 2
  union all select 'login_attempts', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.login_attempts t group by 1, 2
  union all select 'marketing_logs', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.marketing_logs t group by 1, 2
  union all select 'notifications', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.notifications t group by 1, 2
  union all select 'payments', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.payments t group by 1, 2
  union all select 'permissions', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.permissions t group by 1, 2
  union all select 'process_deadlines', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.process_deadlines t group by 1, 2
  union all select 'processes', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.processes t group by 1, 2
  union all select 'products', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.products t group by 1, 2
  union all select 'role_permissions', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.role_permissions t group by 1, 2
  union all select 'roles', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.roles t group by 1, 2
  union all select 'system_settings', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.system_settings t group by 1, 2
  union all select 'task_history', 'sem environment', count(*), count(*) filter (where t.organization_id is null) from public.task_history t
  union all select 'tasks', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.tasks t group by 1, 2
  union all select 'template_variables', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.template_variables t group by 1, 2
  union all select 'trusted_devices', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.trusted_devices t group by 1, 2
  union all select 'user_organizations', 'sem environment', count(*), count(*) filter (where t.organization_id is null) from public.user_organizations t
  union all select 'user_roles', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.user_roles t group by 1, 2
  union all select 'user_sessions', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.user_sessions t group by 1, 2
  union all select 'users', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id is null) from public.users t group by 1, 2
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'tipo_coluna', 'uuid',
  'tabelas_verificadas', 42,
  'tabelas_com_nulos', (select count(*) from dados where nulos > 0),
  'total_nulos', (select coalesce(sum(nulos), 0) from dados),
  'com_nulos', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'tabela', tabela,
                 'environment', environment,
                 'linhas', linhas,
                 'nulos', nulos
               )
               order by tabela, environment
             ),
             '[]'::jsonb
           )
      from dados
     where nulos > 0
  )
)) as resumo;

rollback;

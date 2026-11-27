-- VERIFY - validacao do mapa organization_id x environment
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Regra a validar ANTES de qualquer UPDATE:
--   production -> eaf29983-1998-40a4-bd07-03ea09b4adfa
--                (Alcântara Advocacia, is_demo = false)
--   test       -> cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd
--                (InoveJuris Demonstração, is_demo = true)

begin;

with dados as (
  select 'bank_accounts'::text as tabela, coalesce(t.environment::text, 'sem environment') as environment, count(*) as linhas, count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid) as ja_alcantara, count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid) as ja_demo, count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)) as outros, count(*) filter (where t.organization_id is null) as nulos from public.bank_accounts t group by 1, 2
  union all select 'birthday_messages', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.birthday_messages t group by 1, 2
  union all select 'birthday_templates', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.birthday_templates t group by 1, 2
  union all select 'client_documents', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.client_documents t group by 1, 2
  union all select 'client_interactions', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.client_interactions t group by 1, 2
  union all select 'client_onboarding_tokens', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.client_onboarding_tokens t group by 1, 2
  union all select 'client_tags', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.client_tags t group by 1, 2
  union all select 'clients', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.clients t group by 1, 2
  union all select 'commission_payments', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.commission_payments t group by 1, 2
  union all select 'contracts', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.contracts t group by 1, 2
  union all select 'document_templates', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.document_templates t group by 1, 2
  union all select 'financial_categories', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.financial_categories t group by 1, 2
  union all select 'financial_transactions', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.financial_transactions t group by 1, 2
  union all select 'indicator_tokens', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.indicator_tokens t group by 1, 2
  union all select 'indicators', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.indicators t group by 1, 2
  union all select 'installments', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.installments t group by 1, 2
  union all select 'kanban_boards', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.kanban_boards t group by 1, 2
  union all select 'kanban_columns', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.kanban_columns t group by 1, 2
  union all select 'law_areas', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.law_areas t group by 1, 2
  union all select 'lawyers', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.lawyers t group by 1, 2
  union all select 'legal_contract_workflow', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.legal_contract_workflow t group by 1, 2
  union all select 'legal_contracts', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.legal_contracts t group by 1, 2
  union all select 'login_attempts', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.login_attempts t group by 1, 2
  union all select 'marketing_logs', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.marketing_logs t group by 1, 2
  union all select 'notifications', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.notifications t group by 1, 2
  union all select 'payments', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.payments t group by 1, 2
  union all select 'permissions', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.permissions t group by 1, 2
  union all select 'process_deadlines', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.process_deadlines t group by 1, 2
  union all select 'processes', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.processes t group by 1, 2
  union all select 'products', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.products t group by 1, 2
  union all select 'role_permissions', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.role_permissions t group by 1, 2
  union all select 'roles', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.roles t group by 1, 2
  union all select 'system_settings', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.system_settings t group by 1, 2
  union all select 'tasks', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.tasks t group by 1, 2
  union all select 'template_variables', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.template_variables t group by 1, 2
  union all select 'trusted_devices', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.trusted_devices t group by 1, 2
  union all select 'user_roles', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.user_roles t group by 1, 2
  union all select 'user_sessions', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.user_sessions t group by 1, 2
  union all select 'users', coalesce(t.environment::text, 'sem environment'), count(*), count(*) filter (where t.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid), count(*) filter (where t.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid), count(*) filter (where t.organization_id is not null and t.organization_id not in ('eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid, 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)), count(*) filter (where t.organization_id is null) from public.users t group by 1, 2
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),

  'ambiente_declarado', 'production + test',

  'regra', jsonb_build_object(
    'production', 'eaf29983-1998-40a4-bd07-03ea09b4adfa',
    'test',       'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'
  ),

  'organizacoes_encontradas', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'id', id,
                 'name', name,
                 'slug', slug,
                 'is_demo', is_demo
               )
               order by name
             ),
             '[]'::jsonb
           )
      from public.organizations
     where id in (
       'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid,
       'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
     )
  ),

  'organizacoes_corretas', (
        (select count(*) from public.organizations
          where id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
            and name = 'Alcântara Advocacia'
            and slug = 'alcantara-advocacia'
            and is_demo is false) = 1
    and (select count(*) from public.organizations
          where id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
            and name = 'InoveJuris Demonstração'
            and slug = 'inovejuris-demo-homologacao'
            and is_demo is true) = 1
  ),

  'conflitos_production', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'tabela', tabela,
                 'linhas', linhas,
                 'ja_demo', ja_demo,
                 'outros', outros
               )
               order by tabela
             ),
             '[]'::jsonb
           )
      from dados
     where environment = 'production'
       and (ja_demo > 0 or outros > 0)
  ),

  'conflitos_test', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'tabela', tabela,
                 'linhas', linhas,
                 'ja_alcantara', ja_alcantara,
                 'outros', outros
               )
               order by tabela
             ),
             '[]'::jsonb
           )
      from dados
     where environment = 'test'
       and (ja_alcantara > 0 or outros > 0)
  ),

  'ambientes_fora_do_mapa', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'tabela', tabela,
                 'environment', environment,
                 'linhas', linhas
               )
               order by tabela, environment
             ),
             '[]'::jsonb
           )
      from dados
     where environment not in ('production', 'test')
  ),

  'nulos_a_preencher', jsonb_build_object(
    'production', (select coalesce(sum(nulos), 0) from dados where environment = 'production'),
    'test',       (select coalesce(sum(nulos), 0) from dados where environment = 'test')
  ),

  'pagamentos_em_conflito', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'payment_id', p.id::text,
                 'payment_environment', p.environment,
                 'payment_organization_id', p.organization_id,
                 'installment_id', p.installment_id,
                 'installment_environment', i.environment,
                 'installment_organization_id', i.organization_id,
                 'contract_id', i.contract_id,
                 'contract_environment', c.environment,
                 'contract_organization_id', c.organization_id
               )
               order by p.id::text
             ),
             '[]'::jsonb
           )
      from public.payments p
      left join public.installments i on i.id = p.installment_id
      left join public.contracts c on c.id = i.contract_id
     where p.environment = 'production'
       and p.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
  ),

  'permissoes_em_conflito', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'role_id', rp.role_id,
                 'role_name', r.name,
                 'role_environment', r.environment,
                 'role_organization_id', r.organization_id,
                 'permission_id', rp.permission_id
               )
               order by rp.role_id, rp.permission_id
             ),
             '[]'::jsonb
           )
      from public.role_permissions rp
      left join public.roles r on r.id = rp.role_id
     where rp.environment = 'production'
       and rp.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
  ),

  'kanban_em_conflito', jsonb_build_object(
    'boards', (
      select coalesce(
               jsonb_agg(
                 jsonb_build_object(
                   'id', b.id::text,
                   'name', b.name,
                   'module', b.module
                 )
                 order by b.name, b.id::text
               ),
               '[]'::jsonb
             )
        from public.kanban_boards b
       where b.environment = 'production'
         and b.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
    ),
    'columns', (
      select coalesce(
               jsonb_agg(
                 jsonb_build_object(
                   'id', k.id::text,
                   'board_id', k.board_id::text,
                   'title', k.title
                 )
                 order by k.board_id::text, k.position, k.id::text
               ),
               '[]'::jsonb
             )
        from public.kanban_columns k
       where k.environment = 'production'
         and k.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
    )
  ),

  'mapa_valido_para_update', (
        (select count(*) from public.organizations
          where id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
            and name = 'Alcântara Advocacia'
            and slug = 'alcantara-advocacia'
            and is_demo is false) = 1
    and (select count(*) from public.organizations
          where id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
            and name = 'InoveJuris Demonstração'
            and slug = 'inovejuris-demo-homologacao'
            and is_demo is true) = 1
    and not exists (
          select 1 from dados
         where environment = 'production'
           and (ja_demo > 0 or outros > 0)
        )
    and not exists (
          select 1 from dados
         where environment = 'test'
           and (ja_alcantara > 0 or outros > 0)
        )
  )
)) as resumo;

rollback;

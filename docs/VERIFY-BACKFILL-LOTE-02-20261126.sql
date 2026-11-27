-- VERIFY - previa do LOTE 2 do backfill (71 linhas)
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Tabelas deste lote:
--   indicator_tokens      (11 production + 4 test)
--   indicators            (4 production + 1 test)
--   kanban_columns        (2 production)
--   login_attempts        (5 production)
--   marketing_logs        (6 production)
--   permissions           (3 production)
--   process_deadlines     (2 test)
--   processes             (4 production + 2 test)
--   role_permissions      (19 production)
--   system_settings       (1 test)
--   user_roles            (4 production)
--   users                 (3 production)
--
-- "localizador" usa ctid apenas para mostrar a linha na previa.
-- O UPDATE do lote usara as chaves primarias reais via catalogo.

begin;

with linhas as (
  select 'indicator_tokens'::text as tabela, t.ctid::text as localizador,
         t.environment::text as environment, null::text as organization_id_atual,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end as organization_id_destino,
         (to_jsonb(t) - 'organization_id') as linha
    from public.indicator_tokens t where t.organization_id is null and t.environment in ('production','test')

  union all
  select 'indicators', t.ctid::text, t.environment::text, null::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.indicators t where t.organization_id is null and t.environment in ('production','test')

  union all
  select 'kanban_columns', t.ctid::text, t.environment::text, null::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.kanban_columns t where t.organization_id is null and t.environment in ('production','test')

  union all
  select 'login_attempts', t.ctid::text, t.environment::text, null::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.login_attempts t where t.organization_id is null and t.environment in ('production','test')

  union all
  select 'marketing_logs', t.ctid::text, t.environment::text, null::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.marketing_logs t where t.organization_id is null and t.environment in ('production','test')

  union all
  select 'permissions', t.ctid::text, t.environment::text, null::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.permissions t where t.organization_id is null and t.environment in ('production','test')

  union all
  select 'process_deadlines', t.ctid::text, t.environment::text, null::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.process_deadlines t where t.organization_id is null and t.environment in ('production','test')

  union all
  select 'processes', t.ctid::text, t.environment::text, null::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.processes t where t.organization_id is null and t.environment in ('production','test')

  union all
  select 'role_permissions', t.ctid::text, t.environment::text, null::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.role_permissions t where t.organization_id is null and t.environment in ('production','test')

  union all
  select 'system_settings', t.ctid::text, t.environment::text, null::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.system_settings t where t.organization_id is null and t.environment in ('production','test')

  union all
  select 'user_roles', t.ctid::text, t.environment::text, null::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.user_roles t where t.organization_id is null and t.environment in ('production','test')

  union all
  select 'users', t.ctid::text, t.environment::text, null::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.users t where t.organization_id is null and t.environment in ('production','test')
)
select
  tabela,
  localizador,
  environment,
  organization_id_atual,
  organization_id_destino,
  linha,
  (select count(*) from linhas) as total_linhas
from linhas
order by tabela, environment, localizador;

rollback;

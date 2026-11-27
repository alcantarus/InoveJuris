-- Snapshot somente leitura — backup pré-tenant
-- 26/11/2026
--
-- Objetivo: registrar o estado lógico do banco no momento do backup, para
-- comparação futura. Não é o backup em si; o backup é o dump + PITR + Storage.
--
-- Como usar:
--   1) Execute o arquivo INTEIRO em uma única célula do SQL Editor.
--   2) Copie o JSON e guarde junto com os hashes dos dumps.
--   3) A transação termina em ROLLBACK: nada é alterado.
--
-- Ambiente declarado: 'production' e 'test' (banco único, dois rótulos).

begin;

select jsonb_pretty(jsonb_build_object(
  'snapshot_em', now(),
  'pg_version', current_setting('server_version'),
  'banco', current_database(),
  'wal_lsn', pg_current_wal_lsn()::text,
  'ambiente_declarado', 'production + test',
  'rotulo', 'pre-tenant-20261126',

  'linhas_por_ambiente', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'tabela', x.tabela,
                 'environment', x.environment,
                 'linhas', x.linhas
               )
               order by x.tabela, x.environment
             ),
             '[]'::jsonb
           )
      from (
        select 'users'::text as tabela, environment, count(*) as linhas
          from public.users where environment in ('production','test') group by environment
        union all
        select 'clients'::text, environment, count(*)
          from public.clients where environment in ('production','test') group by environment
        union all
        select 'contracts'::text, environment, count(*)
          from public.contracts where environment in ('production','test') group by environment
        union all
        select 'installments'::text, environment, count(*)
          from public.installments where environment in ('production','test') group by environment
        union all
        select 'payments'::text, environment, count(*)
          from public.payments where environment in ('production','test') group by environment
        union all
        select 'audit_logs'::text, environment, count(*)
          from public.audit_logs where environment in ('production','test') group by environment
        union all
        select 'system_settings'::text, environment, count(*)
          from public.system_settings where environment in ('production','test') group by environment
      ) x
  ),

  'catalogos', jsonb_build_object(
    'organizations', (select count(*) from public.organizations),
    'user_organizations', (select count(*) from public.user_organizations),
    'roles', (select count(*) from public.roles),
    'permissions', (select count(*) from public.permissions)
  ),

  'policies', jsonb_build_object(
    'total', (select count(*) from pg_policies where schemaname = 'public'),
    'com_true_literal', (
      select count(*)
        from pg_policies
       where schemaname = 'public'
         and (
           lower(btrim(coalesce(qual, ''))) = 'true'
           or lower(btrim(coalesce(with_check, ''))) = 'true'
         )
    )
  ),

  'storage_buckets', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'id', b.id,
                 'name', b.name,
                 'public', b.public,
                 'file_size_limit', b.file_size_limit
               )
               order by b.name
             ),
             '[]'::jsonb
           )
      from storage.buckets b
  ),

  'estado_tenant', jsonb_build_object(
    '_rls_organization_id_existe', to_regprocedure('public._rls_organization_id()') is not null,
    '_rls_test_shared_existe', to_regprocedure('public._rls_test_shared()') is not null,
    'get_auth_organization_existe', to_regprocedure('public.get_auth_organization()') is not null,
    'tenant_test_scope', (
      select coalesce(
               jsonb_agg(jsonb_build_object('environment', s.environment, 'value', s.value)),
               '[]'::jsonb
             )
        from public.system_settings s
       where s.key = 'tenant_test_scope'
         and s.environment in ('production', 'test')
    )
  ),

  'nulos_organization_id', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'tabela', x.tabela,
                 'environment', x.environment,
                 'nulos', x.nulos
               )
               order by x.tabela, x.environment
             ),
             '[]'::jsonb
           )
      from (
        select 'clients'::text as tabela, environment,
               count(*) filter (where organization_id is null) as nulos
          from public.clients where environment in ('production','test') group by environment
        union all
        select 'contracts'::text, environment,
               count(*) filter (where organization_id is null)
          from public.contracts where environment in ('production','test') group by environment
        union all
        select 'payments'::text, environment,
               count(*) filter (where organization_id is null)
          from public.payments where environment in ('production','test') group by environment
      ) x
  )
)) as snapshot;

rollback;

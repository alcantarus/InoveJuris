-- Diagnóstico crítico complementar — tenant / Escopo de Ambiente
-- 26/11/2026
--
-- Complemento de docs/DIAGNOSTICO-TENANT-20261126.sql.
-- Objetivo: devolver em UMA ÚNICA SAÍDA (JSON) os dados que destravam o T3/T4:
-- estrutura de organizations, policies USING(true), helpers, nulos em
-- production/test nas tabelas com organization_id já confirmadas, chave
-- tenant_test_scope e estado das views.
--
-- Como usar:
--   1) Execute o arquivo INTEIRO em uma única célula do SQL Editor.
--   2) Copie o JSON devolvido e cole na resposta.
--   3) A transação termina em ROLLBACK: nada é alterado.
--
-- Ambiente declarado: 'production' e 'test' (banco único, dois rótulos).

begin;

select jsonb_pretty(jsonb_build_object(
  'medido_em', now(),
  'pg_version', current_setting('server_version'),
  'ambiente_declarado', 'production + test',

  'organizations', jsonb_build_object(
    'colunas', (
      select coalesce(jsonb_agg(column_name order by ordinal_position), '[]'::jsonb)
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'organizations'
    ),
    'linhas', (select count(*) from public.organizations)
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

  'helpers', jsonb_build_object(
    '_rls_organization_id', to_regprocedure('public._rls_organization_id()') is not null,
    '_rls_test_shared',     to_regprocedure('public._rls_test_shared()') is not null,
    'get_auth_organization', to_regprocedure('public.get_auth_organization()') is not null
  ),

  'nulos_por_tabela', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'tabela', tabela,
                 'environment', environment,
                 'linhas', linhas,
                 'nulos_organization_id', nulos
               )
               order by tabela, environment
             ),
             '[]'::jsonb
           )
      from (
        select 'contracts'::text as tabela,
               environment,
               count(*) as linhas,
               count(*) filter (where organization_id is null) as nulos
          from public.contracts
         where environment in ('production', 'test')
         group by environment
        union all
        select 'clients'::text,
               environment,
               count(*),
               count(*) filter (where organization_id is null)
          from public.clients
         where environment in ('production', 'test')
         group by environment
        union all
        select 'payments'::text,
               environment,
               count(*),
               count(*) filter (where organization_id is null)
          from public.payments
         where environment in ('production', 'test')
         group by environment
      ) x
  ),

  'tenant_test_scope', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object('environment', environment, 'value', value)
               order by environment
             ),
             '[]'::jsonb
           )
      from public.system_settings
     where key = 'tenant_test_scope'
       and environment in ('production', 'test')
  ),

  'views', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object('view', c.relname, 'opcoes', c.reloptions)
               order by c.relname
             ),
             '[]'::jsonb
           )
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'v'
  )
)) as resumo;

-- Nada é commitado.
rollback;

-- Diagnóstico somente leitura — tenant / Escopo de Ambiente
-- 26/11/2026
--
-- Objetivo: medir o estado real do banco ANTES de qualquer DDL de tenant.
-- Modelo considerado: produção dedicada por cliente (partição lógica) e
-- homologação compartilhada (leitura e escrita entre clientes, com performed_by).
--
-- Como usar:
--   1) Execute o arquivo INTEIRO no SQL Editor do Supabase, em uma única célula.
--   2) Tudo roda dentro de transação que termina em ROLLBACK: nenhuma alteração
--      é persistida. Não há DDL nem DML neste arquivo.
--   3)>As contagens por tabela são emitidas como NOTICES (aba "Messages").
--   4) Salve toda a saída. Ela é o baseline dos arquivos FORWARD/VERIFY seguintes.
--
-- Ambiente declarado: 'production' e 'test' (banco único, dois rótulos).
-- Regra: nenhuma célula abaixo presume ambiente sem trazê-lo ou filtrá-lo.

begin;

-- ---------------------------------------------------------------------------
-- 0) Contexto
-- ---------------------------------------------------------------------------
select current_setting('server_version')          as pg_version,
       current_database()                         as banco,
       current_user                               as usuario_sql,
       now()                                      as medido_em,
       'production + test'                        as ambiente_declarado;

-- ---------------------------------------------------------------------------
-- 1) Colunas de tenant por tabela
--    Mostra quais tabelas já têm organization_id, environment e autoria.
-- ---------------------------------------------------------------------------
select c.relname                                                   as tabela,
       bool_or(a.attname = 'organization_id')                     as tem_organization_id,
       bool_or(a.attname = 'environment')                         as tem_environment,
       bool_or(a.attname = 'created_by')                          as tem_created_by,
       bool_or(a.attname = 'performed_by')                        as tem_performed_by
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attribute a
         on a.attrelid = c.oid
        and a.attnum > 0
        and not a.attisdropped
 where n.nspname = 'public'
   and c.relkind = 'r'
 group by c.oid, c.relname
 order by tem_organization_id desc, tem_environment desc, c.relname;

-- ---------------------------------------------------------------------------
-- 2) Views: presença de organization_id/environment e security_invoker
-- ---------------------------------------------------------------------------
select c.relname                                                   as view,
       bool_or(a.attname = 'organization_id')                     as tem_organization_id,
       bool_or(a.attname = 'environment')                         as tem_environment,
       coalesce(c.reloptions::text, '{}')                         as opcoes,
       coalesce(c.reloptions @> array['security_invoker=true'], false) as security_invoker
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attribute a
         on a.attrelid = c.oid
        and a.attnum > 0
        and not a.attisdropped
 where n.nspname = 'public'
   and c.relkind = 'v'
 group by c.oid, c.relname, c.reloptions
 order by c.relname;

-- ---------------------------------------------------------------------------
-- 3) Policies e varredura de USING (true) / WITH CHECK (true)
--    Baseline de 26/11: 0 policies com true literal.
-- ---------------------------------------------------------------------------
select schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;

select count(*)                                                    as total_policies,
       count(distinct tablename)                                   as tabelas_com_policy,
       count(*) filter (
         where lower(btrim(coalesce(qual, ''))) = 'true'
            or lower(btrim(coalesce(with_check, ''))) = 'true'
       )                                                           as policies_com_true,
       count(*) filter (
         where qual ilike '%organization_id%'
            or with_check ilike '%organization_id%'
       )                                                           as policies_com_organization_id,
       count(*) filter (
         where qual ilike '%get_auth_organization%'
            or with_check ilike '%get_auth_organization%'
       )                                                           as policies_com_get_auth_organization
  from pg_policies
 where schemaname = 'public';

-- ---------------------------------------------------------------------------
-- 4) Funções de sessão/RLS/RPC e helpers esperados
-- ---------------------------------------------------------------------------
select p.oid::regprocedure                                         as funcao,
       case p.provolatile when 'i' then 'IMMUTABLE'
                          when 's' then 'STABLE'
                          else 'VOLATILE' end                      as volatilidade,
       p.prosecdef                                                 as security_definer,
       pg_get_function_arguments(p.oid)                           as argumentos
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
         '_rls_claims', '_rls_can_access', '_rls_is_superadmin',
         '_rls_session_valid', '_rls_organization_id', '_rls_test_shared',
         '_auth_session_payload', '_auth_user_payload',
         'get_auth_organization',
         'app_authenticate', 'app_complete_login', 'app_validate_session',
         'app_switch_environment', 'app_switch_organization',
         'app_logout', 'app_logout_all_user_sessions',
         'app_admin_save_user', 'app_admin_delete_user',
         'app_admin_impersonate', 'app_get_security_data',
         'update_account_balance'
       )
 order by p.proname, argumentos;

select to_regprocedure('public._rls_organization_id()')           as helper_organization_id,
       to_regprocedure('public._rls_test_shared()')               as helper_test_shared,
       to_regprocedure('public.get_auth_organization()')          as get_auth_organization;

-- Definições atuais das funções que serão estendidas ou preservadas.
select p.oid::regprocedure                                         as funcao,
       pg_get_functiondef(p.oid)                                  as definicao_atual
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
         '_rls_claims', '_rls_can_access', '_rls_is_superadmin',
         '_auth_user_payload', 'get_auth_organization'
       )
 order by p.proname;

-- ---------------------------------------------------------------------------
-- 5) Grants de execução das funções críticas
-- ---------------------------------------------------------------------------
select p.oid::regprocedure                                         as funcao,
       has_function_privilege('anon', p.oid, 'EXECUTE')            as anon_executa,
       has_function_privilege('authenticated', p.oid, 'EXECUTE')   as authenticated_executa
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
         '_rls_organization_id', '_rls_test_shared', '_rls_can_access',
         '_rls_is_superadmin', '_auth_user_payload',
         'app_validate_session', 'app_switch_environment'
       )
 order by p.proname;

select table_name                                                  as tabela,
       grantee                                                     as papel,
       string_agg(privilege_type, ',' order by privilege_type)     as privilegios
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated')
   and table_name in (
         'users', 'clients', 'contracts', 'installments', 'payments',
         'processes', 'audit_logs', 'user_sessions', 'system_settings'
       )
 group by table_name, grantee
 order by table_name, grantee;

-- ---------------------------------------------------------------------------
-- 6) Contagens por (environment, organization_id) — saída em NOTICES
--    Executa somente em tabelas que têm as duas colunas.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_resumo text;
  v_nulos_production bigint;
  v_nulos_test bigint;
begin
  for r in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and exists (
             select 1 from pg_attribute a
              where a.attrelid = c.oid
                and a.attname = 'organization_id'
                and not a.attisdropped
           )
       and exists (
             select 1 from pg_attribute a
              where a.attrelid = c.oid
                and a.attname = 'environment'
                and not a.attisdropped
           )
     order by c.relname
  loop
    execute format($f$
      select coalesce(
               string_agg(
                 format('%%s/%%s=%%s',
                        coalesce(environment, '?'),
                        coalesce(organization_id::text, '<NULL>'),
                        cnt),
                 ' | ' order by environment, organization_id nulls last),
               '<sem linhas>')
        from (
          select environment, organization_id, count(*) as cnt
            from public.%I
           where environment in ('production', 'test')
           group by environment, organization_id
        ) x
    $f$, r.relname) into v_resumo;

    execute format(
      'select count(*) filter (where organization_id is null and environment = ''production''),'
      || ' count(*) filter (where organization_id is null and environment = ''test'')'
      || ' from public.%I',
      r.relname) into v_nulos_production, v_nulos_test;

    raise notice 'CONTAGEM % | %', r.relname, v_resumo;
    raise notice 'NULOS % | production=% | test=%', r.relname, v_nulos_production, v_nulos_test;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7) Duplicatas relevantes (ambiente declarado: ambos)
-- ---------------------------------------------------------------------------
select 'users'                                                     as origem,
       environment,
       count(*)                                                   as linhas,
       count(distinct lower(email))                               as emails_distintos,
       count(*) - count(distinct lower(email))                    as possiveis_duplicatas
  from public.users
 where environment in ('production', 'test')
 group by environment
 order by environment;

do $$
declare
  v_resumo text;
  v_colunas text;
  v_total bigint;
begin
  if to_regclass('public.organizations') is not null then
    select string_agg(column_name, ', ' order by ordinal_position)
      into v_colunas
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'organizations';

    execute 'select count(*) from public.organizations' into v_total;

    raise notice 'ORGANIZATIONS colunas | %', v_colunas;
    raise notice 'ORGANIZATIONS total de linhas | %', v_total;

    if exists (
         select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'organizations'
            and column_name = 'environment'
       ) then
      execute $f$
        select coalesce(
                 string_agg(format('%s=%s', environment, cnt), ' | ' order by environment),
                 '<sem linhas>')
          from (
            select environment, count(*) as cnt
              from public.organizations
             where environment in ('production', 'test')
             group by environment
          ) x
      $f$ into v_resumo;
      raise notice 'ORGANIZATIONS por environment | %', v_resumo;
    else
      raise notice 'ORGANIZATIONS por environment | tabela sem coluna environment (catálogo global).';
    end if;

    if exists (
         select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'organizations'
            and column_name = 'slug'
       ) then
      execute $f$
        select coalesce(
                 string_agg(format('%s=%s', slug, cnt), ' | ' order by slug),
                 '<sem duplicatas>')
          from (
            select slug, count(*) as cnt
              from public.organizations
             group by slug
            having count(*) > 1
          ) x
      $f$ into v_resumo;
      raise notice 'ORGANIZATIONS duplicatas de slug | %', v_resumo;
    else
      raise notice 'ORGANIZATIONS duplicatas de slug | tabela sem coluna slug.';
    end if;
  else
    raise notice 'ORGANIZATIONS | tabela ainda não existe (esperado antes do T3).';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 8) Configuração de escopo do teste (tabela já existe, PK (key, environment))
-- ---------------------------------------------------------------------------
select key, value, environment, description, category
  from public.system_settings
 where key in ('tenant_test_scope', 'session_timeout', 'maintenance_mode')
   and environment in ('production', 'test')
 order by key, environment;

select a.environment                                               as environment,
       (s.key is not null)                                         as chave_tenant_test_scope_existe,
       s.value                                                     as valor
  from (values ('production'), ('test')) as a(environment)
  left join public.system_settings s
         on s.key = 'tenant_test_scope'
        and s.environment = a.environment
 order by a.environment;

-- ---------------------------------------------------------------------------
-- 9) Storage: buckets e policies de objetos
-- ---------------------------------------------------------------------------
select id, name, public, file_size_limit
  from storage.buckets
 order by name;

select schemaname, tablename, policyname, permissive, cmd, qual, with_check
  from pg_policies
 where schemaname = 'storage'
   and tablename = 'objects'
 order by policyname;

-- ---------------------------------------------------------------------------
-- 10) Interpretação esperada (preencher depois da execução)
-- ---------------------------------------------------------------------------
-- [ ] organization_id existe em quais tabelas?
-- [ ] Há organization_id IS NULL em production? (se sim, T5 antes do T4c)
-- [ ] Há organization_id IS NULL em test? (não impede o braço compartilhado)
-- [ ] total_policies / policies_com_true conferem com 0 policies USING(true)?
-- [ ] helpers _rls_organization_id() e _rls_test_shared() ainda ausentes?
-- [ ] _auth_user_payload versionado ainda sem organization_id?
-- [ ] views com environment sem security_invoker?
-- [x] organizations já existe e é global (sem environment) — confirmado em 26/11 pelo erro 42703 do primeiro diagnóstico.
-- [ ] chave tenant_test_scope ausente em production/test?
-- [x] buckets client_documents, marketing e templates são privados (public=false) — medido em 26/11; templates com 10 MB.
-- [ ] policies de storage.objects filtram só por bucket_id (sem organization_id/environment)?

-- Nada é commitado.
rollback;

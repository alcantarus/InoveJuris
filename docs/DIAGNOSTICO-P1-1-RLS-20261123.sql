-- Diagnóstico somente leitura — P1.1 (volatilidade/RLS/índices de sessão)
-- 23/11/2026
--
-- Objetivo: registrar o BASELINE antes de alterar `_auth_session_payload`,
-- `_rls_session_valid` e os índices de `user_sessions`.
--
-- Como usar:
--   1) Esteja logado no sistema (precisa existir sessão ativa recente).
--   2) Execute o arquivo INTEIRO no SQL Editor do Supabase.
--   3) Tudo roda dentro de uma transação que termina em ROLLBACK: nenhuma
--      alteração é persistida. Não há DDL nem DML neste arquivo.
--   4) Salve a saída dos EXPLAINs para comparar com o arquivo de validação
--      que será escrito depois da aplicação.
--
-- Segurança: as claims abaixo são geradas a partir de uma sessão ativa real,
-- mas nenhum ID é exibido — apenas usado como parâmetro das medições.

begin;

-- ---------------------------------------------------------------------------
-- 1) Contexto e pré-condição
-- ---------------------------------------------------------------------------
select current_setting('server_version')                         as pg_version,
       (select count(*)
          from public.user_sessions
         where logout_at is null
           and last_seen_at > now() - interval '60 seconds')     as sessoes_ativas_recentes;

-- O token da aplicação pode ser assinado com role 'anon' (padrão) ou
-- 'authenticated' (SUPABASE_JWT_ROLE). Descobrir qual dos dois tem SELECT nas
-- tabelas de domínio: a seção 6 usa esse role. Se 'anon' não tiver SELECT,
-- o erro 42501 é esperado e não é problema do diagnóstico.
select has_table_privilege('anon', 'public.processes', 'SELECT')         as anon_le_processes,
       has_table_privilege('authenticated', 'public.processes', 'SELECT') as auth_le_processes,
       has_table_privilege('anon', 'public.clients', 'SELECT')           as anon_le_clients,
       has_table_privilege('authenticated', 'public.clients', 'SELECT')  as auth_le_clients;

-- ---------------------------------------------------------------------------
-- 2) Volatilidade atual das funções envolvidas
--    Esperado antes do P1.1: _auth_session_payload = 'v' (VOLATILE).
--    _rls_session_valid e _rls_can_access já devem estar 's' (STABLE).
-- ---------------------------------------------------------------------------
select p.oid::regprocedure as funcao,
       p.provolatile       as volatilidade,
       case p.provolatile when 'i' then 'IMMUTABLE'
                          when 's' then 'STABLE'
                          else 'VOLATILE' end as volatilidade_texto
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('_auth_session_payload',
                     '_rls_session_valid',
                     '_rls_can_access',
                     'get_auth_organization',
                     '_auth_user_payload')
 order by p.proname;

-- Definição completa das três funções que serão recriadas (para o rollback).
select p.oid::regprocedure as funcao,
       pg_get_functiondef(p.oid) as definicao_atual
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('_auth_session_payload', '_rls_session_valid', '_rls_can_access')
 order by p.proname;

-- get_auth_organization(): existe em produção? (referenciada na policy legada
-- "Isolamento por Organização em users", mas sem código no repositório)
select to_regprocedure('public.get_auth_organization()') as get_auth_organization;

-- ---------------------------------------------------------------------------
-- 3) Índices existentes em user_sessions e policies SELECT em users
--    A policy legada com get_auth_organization() NÃO deve ser alterada.
-- ---------------------------------------------------------------------------
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename  = 'user_sessions'
 order by indexname;

select policyname, permissive, roles, qual
  from pg_policies
 where schemaname = 'public'
   and tablename  = 'users'
   and cmd        = 'SELECT'
 order by policyname;

-- ---------------------------------------------------------------------------
-- 4) Claims de exemplo para as medições com RLS
--    O parâmetro final de set_config é `true` = SET LOCAL (só nesta transação).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', jsonb_build_object(
         'role',          'anon',
         'session_id',    s.id::text,
         'environment',   s.environment,
         'sub',           s.user_id::text,
         'is_superadmin', false
       )::text, true)
  from (
        select id, environment, user_id
          from public.user_sessions
         where logout_at is null
           and last_seen_at > now() - interval '60 seconds'
         order by last_seen_at desc
         limit 1
       ) s;

select case
         when current_setting('request.jwt.claims', true) is null
           then 'ATENÇÃO: sem sessão ativa recente. Abra o sistema e repita; as medições de RLS não serão representativas.'
           else 'Claims de exemplo configuradas (sessão ativa encontrada).'
       end as aviso;

-- ---------------------------------------------------------------------------
-- 5) Baseline das funções (sem RLS de tabela; mede o custo da função em si)
-- ---------------------------------------------------------------------------
explain (analyze, buffers, summary on)
select public._auth_session_payload(
         (current_setting('request.jwt.claims', true)::jsonb->>'session_id')::uuid,
         'production'
       );

explain (analyze, buffers, summary on)
select public._rls_can_access('production');

-- RPC usada no bootstrap do dashboard (baseline do parecer: ~95 ms/chamada)
explain (analyze, buffers, summary on)
select public.app_validate_session(
         (current_setting('request.jwt.claims', true)::jsonb->>'session_id')::uuid,
         'production'
       );

-- ---------------------------------------------------------------------------
-- 6) Baseline com RLS real: consultas de domínio com o role da aplicação
--    Usa 'anon' se ele tiver SELECT em processes; senão 'authenticated'.
--    (set_config com is_local = true equivale a SET LOCAL ROLE.)
-- ---------------------------------------------------------------------------
select set_config('role',
                  case when has_table_privilege('anon', 'public.processes', 'SELECT')
                       then 'anon' else 'authenticated' end,
                  true) as role_da_medicao;

explain (analyze, buffers, summary on)
select count(*) from public.clients;

explain (analyze, buffers, summary on)
select count(*) from public.processes;

reset role;

-- ---------------------------------------------------------------------------
-- 7) Baseline dos filtros que os índices novos pretendem acelerar
--    Em tabelas pequenas o planner pode escolher Seq Scan: o que importa é
--    repetir EXATAMENTE as mesmas consultas depois da aplicação.
-- ---------------------------------------------------------------------------
explain (analyze, buffers, summary on)
select count(*)
  from public.user_sessions
 where user_id = (select user_id from public.user_sessions order by last_seen_at desc limit 1)
   and logout_at is null;

explain (analyze, buffers, summary on)
select count(*)
  from public.user_sessions
 where user_id = (select user_id from public.user_sessions order by last_seen_at desc limit 1)
   and user_agent = (select user_agent from public.user_sessions order by last_seen_at desc limit 1);

explain (analyze, buffers, summary on)
select id, user_id, login_at
  from public.user_sessions
 where environment = 'production'
 order by login_at desc
 limit 500;

-- Nada é commitado.
rollback;

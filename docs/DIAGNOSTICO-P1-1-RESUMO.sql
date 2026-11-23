-- Diagnóstico P1.1 — RESUMO EM UMA ÚNICA LINHA (jsonb)
-- 23/11/2026
--
-- Substitui o arquivo DIAGNOSTICO-P1-1-RLS-20261123.sql para facilitar a cópia.
-- Devolve UMA linha, UMA coluna: copie a célula `diagnostico` e cole aqui.
--
-- Somente leitura: usa EXPLAIN ANALYZE em SELECTs e termina em ROLLBACK.
-- Pré-requisito: estar logado no sistema (sessão ativa recente).

begin;

-- Claims de exemplo a partir de uma sessão ativa real (ID não é exibido).
-- O coalesce garante que a chave seja sempre definida, mesmo sem sessão ativa.
select set_config('request.jwt.claims', coalesce((
         select jsonb_build_object(
                  'role',          'anon',
                  'session_id',    s.id::text,
                  'environment',   s.environment,
                  'sub',           s.user_id::text,
                  'is_superadmin', false
                )::text
           from (
                 select id, environment, user_id
                   from public.user_sessions
                  where logout_at is null
                    and last_seen_at > now() - interval '60 seconds'
                  order by last_seen_at desc
                  limit 1
                ) s
       ), '{}'::text), true);

-- Captura o "Execution Time" de cada EXPLAIN em variáveis de transação.
do $$
declare
  v         json;
  v_sid     uuid := (current_setting('request.jwt.claims', true)::jsonb->>'session_id')::uuid;
  v_env     text := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'environment', 'production');
  v_role    text := case
                      when has_table_privilege('anon', 'public.processes', 'SELECT')
                       and has_table_privilege('anon', 'public.clients', 'SELECT')
                        then 'anon'
                      else 'authenticated'
                    end;
begin
  perform set_config('diag.role', v_role, true);
  perform set_config('diag.ambiente', v_env, true);
  perform set_config('diag.sessao', ((v_sid is not null)::text), true);

  begin
    execute format(
      'explain (analyze, buffers, format json) select public._auth_session_payload(%L::uuid, %L)',
      v_sid, v_env
    ) into v;
    perform set_config('diag.ms_payload', v->0->>'Execution Time', true);
  exception when others then
    perform set_config('diag.ms_payload', 'ERRO: ' || sqlerrm, true);
  end;

  begin
    execute format(
      'explain (analyze, buffers, format json) select public._rls_can_access(%L)',
      v_env
    ) into v;
    perform set_config('diag.ms_can_access', v->0->>'Execution Time', true);
  exception when others then
    perform set_config('diag.ms_can_access', 'ERRO: ' || sqlerrm, true);
  end;

  begin
    execute format(
      'explain (analyze, buffers, format json) select public.app_validate_session(%L::uuid, %L)',
      v_sid, v_env
    ) into v;
    perform set_config('diag.ms_validate', v->0->>'Execution Time', true);
  exception when others then
    perform set_config('diag.ms_validate', 'ERRO: ' || sqlerrm, true);
  end;

  -- Consultas de domínio com RLS, usando o role que a aplicação realmente usa.
  perform set_config('role', v_role, true);

  begin
    execute 'explain (analyze, buffers, format json) select count(*) from public.clients' into v;
    perform set_config('diag.ms_clients_rls', v->0->>'Execution Time', true);
  exception when others then
    perform set_config('diag.ms_clients_rls', 'ERRO: ' || sqlerrm, true);
  end;

  begin
    execute 'explain (analyze, buffers, format json) select count(*) from public.processes' into v;
    perform set_config('diag.ms_processes_rls', v->0->>'Execution Time', true);
  exception when others then
    perform set_config('diag.ms_processes_rls', 'ERRO: ' || sqlerrm, true);
  end;
end $$;

reset role;

-- Única linha de saída.
select jsonb_pretty(jsonb_build_object(
  'pg_version', current_setting('server_version'),

  'sessao_encontrada', current_setting('diag.sessao')::boolean,
  'ambiente_medido',   current_setting('diag.ambiente'),

  'sessoes_ativas_recentes', (
    select count(*) from public.user_sessions
     where logout_at is null
       and last_seen_at > now() - interval '60 seconds'
  ),

  'permissoes', jsonb_build_object(
    'anon_le_processes',          has_table_privilege('anon', 'public.processes', 'SELECT'),
    'authenticated_le_processes', has_table_privilege('authenticated', 'public.processes', 'SELECT'),
    'anon_le_clients',            has_table_privilege('anon', 'public.clients', 'SELECT'),
    'authenticated_le_clients',   has_table_privilege('authenticated', 'public.clients', 'SELECT'),
    'role_usado_na_medicao',      current_setting('diag.role')
  ),

  'volatilidade', jsonb_build_object(
    '_auth_session_payload', (
      select case p.provolatile when 's' then 'STABLE'
                                when 'i' then 'IMMUTABLE'
                                else 'VOLATILE' end
        from pg_proc p
       where p.oid = to_regprocedure('public._auth_session_payload(uuid,text)')
    ),
    '_rls_session_valid', (
      select case p.provolatile when 's' then 'STABLE'
                                when 'i' then 'IMMUTABLE'
                                else 'VOLATILE' end
        from pg_proc p
       where p.oid = to_regprocedure('public._rls_session_valid()')
    ),
    '_rls_can_access', (
      select case p.provolatile when 's' then 'STABLE'
                                when 'i' then 'IMMUTABLE'
                                else 'VOLATILE' end
        from pg_proc p
       where p.oid = to_regprocedure('public._rls_can_access(text)')
    ),
    '_auth_user_payload', (
      select case p.provolatile when 's' then 'STABLE'
                                when 'i' then 'IMMUTABLE'
                                else 'VOLATILE' end
        from pg_proc p
       where p.oid = to_regprocedure('public._auth_user_payload(public.users,uuid)')
    )
  ),

  'get_auth_organization', jsonb_build_object(
    'existe', (
      select exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'get_auth_organization'
      )
    ),
    'volatilidade_e_assinatura', (
      select string_agg(distinct
               p.oid::regprocedure::text || ' => ' ||
               case p.provolatile when 's' then 'STABLE'
                                  when 'i' then 'IMMUTABLE'
                                  else 'VOLATILE' end, ', ')
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'get_auth_organization'
    ),
    'definicao_inicio', (
      select left(pg_get_functiondef(p.oid), 800)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'get_auth_organization'
       order by p.oid
       limit 1
    )
  ),

  'indices_user_sessions', (
    select string_agg(indexdef, E'\n' order by indexname)
      from pg_indexes
     where schemaname = 'public' and tablename = 'user_sessions'
  ),

  'policies_users_select', (
    select string_agg(
             policyname || ' [' || coalesce(permissive::text, '-') || '] USING ' ||
             coalesce(qual::text, '-'),
             E'\n' order by policyname
           )
      from pg_policies
     where schemaname = 'public' and tablename = 'users' and cmd = 'SELECT'
  ),

  'tempos_ms', jsonb_build_object(
    '_auth_session_payload', current_setting('diag.ms_payload'),
    '_rls_can_access',       current_setting('diag.ms_can_access'),
    'app_validate_session',  current_setting('diag.ms_validate'),
    'clients_com_rls',       current_setting('diag.ms_clients_rls'),
    'processes_com_rls',     current_setting('diag.ms_processes_rls')
  ),

  'definicoes_atuais', jsonb_build_object(
    '_auth_session_payload', (
      select pg_get_functiondef(p.oid)
        from pg_proc p where p.oid = to_regprocedure('public._auth_session_payload(uuid,text)')
    ),
    '_rls_session_valid', (
      select pg_get_functiondef(p.oid)
        from pg_proc p where p.oid = to_regprocedure('public._rls_session_valid()')
    ),
    '_rls_can_access', (
      select pg_get_functiondef(p.oid)
        from pg_proc p where p.oid = to_regprocedure('public._rls_can_access(text)')
    )
  )
)) as diagnostico;

rollback;

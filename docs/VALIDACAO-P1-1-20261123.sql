-- Validação pós-apply do P1.1 — UMA célula JSON
-- 23/11/2026
--
-- Rodar DEPOIS de supabase/migrations/p1_1/01_p1_1_session_rls_apply.sql.
-- Somente leitura, termina em ROLLBACK. Precisa de sessão ativa recente.
-- Para comparar os tempos, rode também docs/DIAGNOSTICO-P1-1-RESUMO.sql.

begin;

-- 1) Sem token: _rls_session_valid() deve ser false.
select set_config('request.jwt.claims', '{}'::jsonb::text, true);

do $$
declare
  v boolean;
begin
  select public._rls_session_valid() into v;
  perform set_config('val.sem_token', v::text, true);
end $$;

-- 2) Com token de uma sessão real: guardar as claims para restaurar depois.
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

select set_config('val.claims', current_setting('request.jwt.claims', true), true);

do $$
declare
  v         boolean;
  v_sid     uuid := (current_setting('val.claims')::jsonb->>'session_id')::uuid;
  v_env     text := coalesce(current_setting('val.claims')::jsonb->>'environment', 'production');
  v_outro   text := case when v_env = 'production' then 'test' else 'production' end;
  v_claims  text := current_setting('val.claims');
  v_valid   jsonb;
begin
  -- Sessão válida com as claims reais.
  select public._rls_session_valid() into v;
  perform set_config('val.com_token', v::text, true);

  -- Payload antigo e helper novo precisam concordar.
  select public._auth_session_payload(v_sid, v_env) is not null into v;
  perform set_config('val.payload_valido', v::text, true);

  -- RPC de validação usada no bootstrap.
  select public.app_validate_session(v_sid, v_env) into v_valid;
  perform set_config('val.app_validate', coalesce(v_valid->>'valid', 'false'), true);

  -- Environment diferente da claim deve ser recusado.
  perform set_config('request.jwt.claims', jsonb_build_object(
    'role',          'anon',
    'session_id',    v_sid::text,
    'environment',   v_outro,
    'sub',           current_setting('val.claims')::jsonb->>'sub',
    'is_superadmin', false
  )::text, true);

  select public._rls_session_valid() into v;
  perform set_config('val.ambiente_errado', v::text, true);

  -- Restaura as claims reais para a saída final.
  perform set_config('request.jwt.claims', v_claims, true);
end $$;

-- Saída única.
select jsonb_pretty(jsonb_build_object(
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
    )
  ),
  'testes', jsonb_build_object(
    'sessao_encontrada',  (current_setting('val.claims')::jsonb->>'session_id') is not null,
    'sem_token_deve_ser_false',      current_setting('val.sem_token')::boolean,
    'com_token_deve_ser_true',       current_setting('val.com_token')::boolean,
    'payload_deve_ser_true',         current_setting('val.payload_valido')::boolean,
    'app_validate_deve_ser_true',    current_setting('val.app_validate')::boolean,
    'ambiente_errado_deve_ser_false', current_setting('val.ambiente_errado')::boolean
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
  )
)) as validacao;

rollback;

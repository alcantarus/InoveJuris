-- P1.1 — medição com 5 repetições e mediana
-- 23/11/2026
--
-- Use para decidir se a mudança de volatilidade/helper ajudou ou se a diferença
-- vista numa única execução foi ruído. Rode com o sistema aberto.
-- Somente leitura, termina em ROLLBACK. Devolve UMA célula JSON.
--
-- Interpretação: compare a `mediana_ms` desta execução com o baseline
-- (docs/DIAGNOSTICO-P1-1-RESUMO.sql antes do apply):
--   payload 2,625 | can_access 2,106 | validate 1,820
--   clients 110,732 | processes 10,949

begin;

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

do $$
declare
  v           json;
  v_sid       uuid := (current_setting('request.jwt.claims', true)::jsonb->>'session_id')::uuid;
  v_env       text := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'environment', 'production');
  v_role      text := case
                        when has_table_privilege('anon', 'public.processes', 'SELECT')
                         and has_table_privilege('anon', 'public.clients', 'SELECT')
                          then 'anon'
                        else 'authenticated'
                      end;
  a_payload   text[] := '{}'::text[];
  a_can       text[] := '{}'::text[];
  a_validate  text[] := '{}'::text[];
  a_clients   text[] := '{}'::text[];
  a_processes text[] := '{}'::text[];
  i           integer;
begin
  perform set_config('diag.role', v_role, true);
  perform set_config('diag.ambiente', v_env, true);

  -- Funções de sessão: 5 repetições antes de trocar o role.
  for i in 1..5 loop
    begin
      execute format(
        'explain (analyze, buffers, format json) select public._auth_session_payload(%L::uuid, %L)',
        v_sid, v_env
      ) into v;
      a_payload := a_payload || coalesce(v->0->>'Execution Time', 'nulo');
    exception when others then
      a_payload := a_payload || ('ERRO: ' || sqlerrm);
    end;

    begin
      execute format(
        'explain (analyze, buffers, format json) select public._rls_can_access(%L)',
        v_env
      ) into v;
      a_can := a_can || coalesce(v->0->>'Execution Time', 'nulo');
    exception when others then
      a_can := a_can || ('ERRO: ' || sqlerrm);
    end;

    begin
      execute format(
        'explain (analyze, buffers, format json) select public.app_validate_session(%L::uuid, %L)',
        v_sid, v_env
      ) into v;
      a_validate := a_validate || coalesce(v->0->>'Execution Time', 'nulo');
    exception when others then
      a_validate := a_validate || ('ERRO: ' || sqlerrm);
    end;
  end loop;

  -- Consultas de domínio com RLS, role que a aplicação realmente usa.
  perform set_config('role', v_role, true);

  for i in 1..5 loop
    begin
      execute 'explain (analyze, buffers, format json) select count(*) from public.clients' into v;
      a_clients := a_clients || coalesce(v->0->>'Execution Time', 'nulo');
    exception when others then
      a_clients := a_clients || ('ERRO: ' || sqlerrm);
    end;

    begin
      execute 'explain (analyze, buffers, format json) select count(*) from public.processes' into v;
      a_processes := a_processes || coalesce(v->0->>'Execution Time', 'nulo');
    exception when others then
      a_processes := a_processes || ('ERRO: ' || sqlerrm);
    end;
  end loop;

  -- Guarda como jsonb para preservar aspas/ vírgulas de mensagens de erro.
  perform set_config('diag.arr_payload',   to_jsonb(a_payload)::text,   true);
  perform set_config('diag.arr_can',       to_jsonb(a_can)::text,       true);
  perform set_config('diag.arr_validate',  to_jsonb(a_validate)::text,  true);
  perform set_config('diag.arr_clients',   to_jsonb(a_clients)::text,   true);
  perform set_config('diag.arr_processes', to_jsonb(a_processes)::text, true);
end $$;

reset role;

select jsonb_pretty(jsonb_build_object(
  'role',          current_setting('diag.role'),
  'ambiente',      current_setting('diag.ambiente'),
  'repeticoes',    5,
  'series', jsonb_build_object(
    '_auth_session_payload', current_setting('diag.arr_payload')::jsonb,
    '_rls_can_access',       current_setting('diag.arr_can')::jsonb,
    'app_validate_session',  current_setting('diag.arr_validate')::jsonb,
    'clients_com_rls',       current_setting('diag.arr_clients')::jsonb,
    'processes_com_rls',     current_setting('diag.arr_processes')::jsonb
  ),
  'mediana_ms', jsonb_build_object(
    '_auth_session_payload', (
      select x::numeric
        from jsonb_array_elements_text(current_setting('diag.arr_payload')::jsonb) as t(x)
       where x ~ '^[0-9.]+$'
       order by x::numeric
       limit 1 offset 2
    ),
    '_rls_can_access', (
      select x::numeric
        from jsonb_array_elements_text(current_setting('diag.arr_can')::jsonb) as t(x)
       where x ~ '^[0-9.]+$'
       order by x::numeric
       limit 1 offset 2
    ),
    'app_validate_session', (
      select x::numeric
        from jsonb_array_elements_text(current_setting('diag.arr_validate')::jsonb) as t(x)
       where x ~ '^[0-9.]+$'
       order by x::numeric
       limit 1 offset 2
    ),
    'clients_com_rls', (
      select x::numeric
        from jsonb_array_elements_text(current_setting('diag.arr_clients')::jsonb) as t(x)
       where x ~ '^[0-9.]+$'
       order by x::numeric
       limit 1 offset 2
    ),
    'processes_com_rls', (
      select x::numeric
        from jsonb_array_elements_text(current_setting('diag.arr_processes')::jsonb) as t(x)
       where x ~ '^[0-9.]+$'
       order by x::numeric
       limit 1 offset 2
    )
  )
)) as comparacao;

rollback;

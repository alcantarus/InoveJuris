-- Benchmark somente leitura — lentidão percebida após P0/P1 de Contratos
-- 24/11/2026
--
-- Objetivo: separar, com medição, as causas candidatas da lentidão relatada:
--   1) RLS por linha (_rls_can_access(environment)) em tabelas/views;
--   2) search_all com to_jsonb(p) no ramo de processos;
--   3) views de dashboard com Estornado excluído;
--   4) índices/unicidade do P1 (efeito esperado: nenhum em leitura).
--
-- Como usar:
--   - Entrar no sistema e deixar uma aba aberta (heartbeat < 60 s). Sem sessão
--     ativa a medição é inválida — o JSON avisa.
--   - Rodar o arquivo INTEIRO no SQL Editor. Devolve UMA célula: comparacao.
--   - Termina em ROLLBACK. Nenhum DDL, nenhum UPDATE/DELETE.
--
-- Baselines de referência (docs/HANDOFF-P1-1-20261123.md, 5 repetições):
--   _auth_session_payload 0,652 ms | _rls_can_access 0,868 ms
--   app_validate_session  0,786 ms | clients 165,010 ms | processes 10,129 ms

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

-- ---------------------------------------------------------------------------
-- Bloco A — funções de sessão + consultas com RLS (role real da aplicação)
-- ---------------------------------------------------------------------------
do $$
declare
  v             json;
  v_results     jsonb := '[]'::jsonb;
  v_sid         uuid := nullif(current_setting('request.jwt.claims', true)::jsonb->>'session_id', '')::uuid;
  v_env         text := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'environment', 'production');
  v_role        text := case
                          when has_table_privilege('anon', 'public.processes', 'SELECT')
                           and has_table_privilege('anon', 'public.clients', 'SELECT')
                            then 'anon'
                          else 'authenticated'
                        end;
  v_term        text := '%' || public.immutable_unaccent(lower('ana')) || '%';
  v_expr        text;
  v_series      jsonb := '[]'::jsonb;
  r             record;
  i             integer;
begin
  perform set_config('bench.role_app', v_role, true);
  perform set_config('bench.ambiente', v_env, true);
  perform set_config('bench.termo', v_term, true);

  -- Colunas textuais reais de processes, descobertas no banco (sem supor nomes).
  select coalesce(
           string_agg(
             format(
               'public.immutable_unaccent(lower(coalesce(%I::text, ''''))) ILIKE %L',
               column_name, v_term
             ),
             ' OR ' order by ordinal_position
           ),
           'false'
         )
    into v_expr
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'processes'
     and data_type in ('text', 'character varying', 'character', 'citext');

  -- Funções de sessão (mesmas séries do P1.1).
  v_series := v_series || jsonb_build_array(
    jsonb_build_object(
      'serie', '_auth_session_payload',
      'sql', format(
        'explain (analyze, buffers, format json) select public._auth_session_payload(%L::uuid, %L)',
        v_sid, v_env
      )
    ),
    jsonb_build_object(
      'serie', '_rls_can_access',
      'sql', format(
        'explain (analyze, buffers, format json) select public._rls_can_access(%L)',
        v_env
      )
    ),
    jsonb_build_object(
      'serie', 'app_validate_session',
      'sql', format(
        'explain (analyze, buffers, format json) select public.app_validate_session(%L::uuid, %L)',
        v_sid, v_env
      )
    )
  );

  -- Tabelas e views com RLS, role que a aplicação realmente usa.
  v_series := v_series || coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'serie', t.nome || '_com_rls',
               'sql', format(
                 'explain (analyze, buffers, format json) select count(*) from public.%I',
                 t.nome
               )
             )
             order by t.nome
           )
      from unnest(array[
             'contracts', 'commission_payments', 'clients', 'processes',
             'installments', 'payments',
             'vw_dashboard_receivables_metrics',
             'vw_dashboard_top_defaulters',
             'vw_dashboard_receivables_forecast'
           ]) as t(nome)
  ), '[]'::jsonb);

  -- Busca global e controles do ramo de processos.
  v_series := v_series || jsonb_build_array(
    jsonb_build_object(
      'serie', 'search_all_com_rls',
      'sql', $q$explain (analyze, buffers, format json) select public.search_all('ana', 'production')$q$
    ),
    jsonb_build_object(
      'serie', 'search_colunas_diretas',
      'sql', format(
        'explain (analyze, buffers, format json) select count(*) from public.processes p where %s',
        v_expr
      )
    ),
    jsonb_build_object(
      'serie', 'processos_to_jsonb',
      'sql', $q$explain (analyze, buffers, format json)
             select count(*) from public.processes p
              where public.immutable_unaccent(lower(coalesce(to_jsonb(p) ->> 'client', ''))) ILIKE '%ana%'$q$
    )
  );

  perform set_config('role', v_role, true);

  for r in select x.serie, x.sql from jsonb_to_recordset(v_series) as x(serie text, sql text) loop
    for i in 1..5 loop
      begin
        execute r.sql into v;
        v_results := v_results || jsonb_build_object(
          'serie', r.serie,
          'ms', (v->0->>'Execution Time')::numeric,
          'erro', null
        );
      exception when others then
        v_results := v_results || jsonb_build_object(
          'serie', r.serie,
          'ms', null,
          'erro', sqlerrm
        );
      end;
    end loop;
  end loop;

  perform set_config('bench.com_rls', v_results::text, true);
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Bloco B — mesmas consultas sem RLS (role original do SQL Editor)
-- Diferença com_rls - sem_rls isola o custo das policies.
-- ---------------------------------------------------------------------------
do $$
declare
  v         json;
  v_results jsonb := '[]'::jsonb;
  v_series  jsonb := '[]'::jsonb;
  r         record;
  i         integer;
begin
  perform set_config('bench.role_sem_rls', current_user, true);

  v_series := v_series || coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'serie', t.nome || '_sem_rls',
               'sql', format(
                 'explain (analyze, buffers, format json) select count(*) from public.%I',
                 t.nome
               )
             )
             order by t.nome
           )
      from unnest(array[
             'contracts', 'commission_payments', 'clients', 'processes',
             'installments', 'payments',
             'vw_dashboard_receivables_metrics',
             'vw_dashboard_top_defaulters',
             'vw_dashboard_receivables_forecast'
           ]) as t(nome)
  ), '[]'::jsonb);

  v_series := v_series || jsonb_build_array(
    jsonb_build_object(
      'serie', 'search_all_sem_rls',
      'sql', $q$explain (analyze, buffers, format json) select public.search_all('ana', 'production')$q$
    )
  );

  for r in select x.serie, x.sql from jsonb_to_recordset(v_series) as x(serie text, sql text) loop
    for i in 1..5 loop
      begin
        execute r.sql into v;
        v_results := v_results || jsonb_build_object(
          'serie', r.serie,
          'ms', (v->0->>'Execution Time')::numeric,
          'erro', null
        );
      exception when others then
        v_results := v_results || jsonb_build_object(
          'serie', r.serie,
          'ms', null,
          'erro', sqlerrm
        );
      end;
    end loop;
  end loop;

  perform set_config('bench.sem_rls', v_results::text, true);
end $$;

-- ---------------------------------------------------------------------------
-- Resultado único: séries, medianas, delta RLS e baselines de referência.
-- ---------------------------------------------------------------------------
with amostras as (
  select 'com_rls'::text as grupo, x.serie, x.ms, x.erro
    from jsonb_to_recordset(current_setting('bench.com_rls')::jsonb)
      as x(serie text, ms numeric, erro text)
  union all
  select 'sem_rls'::text, x.serie, x.ms, x.erro
    from jsonb_to_recordset(current_setting('bench.sem_rls')::jsonb)
      as x(serie text, ms numeric, erro text)
), med as (
  select grupo, serie,
         percentile_cont(0.5) within group (order by ms::double precision) as mediana,
         count(*) filter (where ms is not null) as n_ok
    from amostras
   where ms is not null
   group by grupo, serie
), delta as (
  select c.serie,
         round(c.mediana::numeric, 3) as com_rls_ms,
         round(s.mediana::numeric, 3) as sem_rls_ms,
         round((c.mediana - s.mediana)::numeric, 3) as custo_rls_ms
    from med c
    join med s on s.serie = replace(c.serie, '_com_rls', '_sem_rls')
   where right(c.serie, 8) = '_com_rls'
)
select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'servidor', current_setting('server_version'),
  'role_app', current_setting('bench.role_app'),
  'role_sem_rls', current_setting('bench.role_sem_rls'),
  'ambiente', current_setting('bench.ambiente'),
  'termo', current_setting('bench.termo'),
  'repeticoes', 5,
  'sessoes_ativas_recentes', (
    select count(*) from public.user_sessions
     where logout_at is null and last_seen_at > now() - interval '60 seconds'
  ),
  'aviso', case
    when current_setting('request.jwt.claims', true)::jsonb ? 'session_id' then null
    else 'SEM SESSÃO ATIVA: claims vazias; medição inválida. Entre no sistema, deixe uma aba aberta e repita.'
  end,
  'baselines_p1_1_ms', jsonb_build_object(
    '_auth_session_payload', 0.652,
    '_rls_can_access', 0.868,
    'app_validate_session', 0.786,
    'clients_com_rls', 165.010,
    'processes_com_rls', 10.129
  ),
  'mediana_ms', (
    select jsonb_object_agg(grupo || '/' || serie, round(mediana::numeric, 3))
      from med
  ),
  'delta_rls_ms', (
    select coalesce(
             jsonb_object_agg(
               replace(serie, '_com_rls', ''),
               jsonb_build_object(
                 'com_rls', com_rls_ms,
                 'sem_rls', sem_rls_ms,
                 'custo_rls', custo_rls_ms
               )
             ), '{}'::jsonb)
      from delta
  ),
  'colunas_processes', (
    select coalesce(jsonb_agg(column_name order by ordinal_position), '[]'::jsonb)
      from information_schema.columns
     where table_schema = 'public' and table_name = 'processes'
  ),
  'contagens', jsonb_build_object(
    'contracts', (select count(*) from public.contracts),
    'installments', (select count(*) from public.installments),
    'payments', (select count(*) from public.payments),
    'commission_payments', (select count(*) from public.commission_payments)
  ),
  'erros', (
    select coalesce(jsonb_agg(jsonb_build_object('serie', serie, 'erro', erro)), '[]'::jsonb)
      from amostras where erro is not null
  ),
  'series', (
    select coalesce(jsonb_agg(
             jsonb_build_object('grupo', grupo, 'serie', serie, 'ms', ms, 'erro', erro)
             order by grupo, serie
           ), '[]'::jsonb)
      from amostras
  )
)) as comparacao;

rollback;

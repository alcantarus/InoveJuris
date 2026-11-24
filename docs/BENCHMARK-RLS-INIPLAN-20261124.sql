-- Prova de conceito — correção de RLS por linha (somente leitura)
-- 24/11/2026
--
-- O benchmark de 18:40:45 UTC mediu, com role authenticated e 5 repetições:
--   clients 163,286 ms | payments 111,596 ms | installments 114,463 ms
--   contracts 78,985 ms | processes 10,245 ms | search_all 81,822 ms
-- contra 0,02 a 0,26 ms sem RLS. Custo quase todo nas policies.
--
-- Hipótese: _rls_can_access(environment) é SECURITY DEFINER e recebe uma
-- coluna, então é avaliada por linha. A expressão equivalente abaixo move a
-- validação da sessão para um InitPlan (uma chamada por statement) e deixa a
-- comparação de environment como SQL simples:
--
--   (select public._rls_can_access(null))
--   AND (environment IS NULL OR environment = coalesce(
--          nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'environment', ''),
--          'production'))
--
-- isto é exatamente a definição de _rls_can_access(environment):
--   _rls_session_valid() AND (p_environment IS NULL OR p_environment = _rls_environment())
--
-- Nenhuma GRANT nova é necessária: _rls_can_access(text) já é executável por
-- anon/authenticated; current_setting() é leitura de GUC da própria sessão.
--
-- Rode o arquivo INTEIRO com o sistema aberto (heartbeat < 60 s).
-- UMA célula: comparacao. Termina em ROLLBACK. Sem DDL, sem UPDATE/DELETE.

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
-- Série 1 — estado atual com RLS, role da aplicação.
-- ---------------------------------------------------------------------------
do $$
declare
  v         json;
  v_results jsonb := '[]'::jsonb;
  v_role    text := case
                      when has_table_privilege('anon', 'public.processes', 'SELECT')
                       and has_table_privilege('anon', 'public.clients', 'SELECT')
                        then 'anon'
                      else 'authenticated'
                    end;
  r         record;
  i         integer;
begin
  perform set_config('rlsteste.role_app', v_role, true);
  perform set_config('role', v_role, true);

  for r in
    select x.serie, x.sql
      from jsonb_to_recordset(jsonb_build_array(
        jsonb_build_object(
          'serie', 'clients_rls_atual',
          'sql', 'explain (analyze, buffers, format json) select count(*) from public.clients'
        ),
        jsonb_build_object(
          'serie', 'payments_rls_atual',
          'sql', 'explain (analyze, buffers, format json) select count(*) from public.payments'
        ),
        jsonb_build_object(
          'serie', 'contracts_rls_atual',
          'sql', 'explain (analyze, buffers, format json) select count(*) from public.contracts'
        )
      )) as x(serie text, sql text)
  loop
    for i in 1..5 loop
      begin
        execute r.sql into v;
        v_results := v_results || jsonb_build_object(
          'serie', r.serie, 'ms', (v->0->>'Execution Time')::numeric, 'erro', null
        );
      exception when others then
        v_results := v_results || jsonb_build_object(
          'serie', r.serie, 'ms', null, 'erro', sqlerrm
        );
      end;
    end loop;
  end loop;

  perform set_config('rlsteste.atual', v_results::text, true);
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Série 2 — controladores sem RLS (role owner, RLS não se aplica):
--   a) expressão antiga chamada por linha;
--   b) expressão proposta com InitPlan.
-- Se (b) for ~mil vezes mais rápida que (a), a troca das policies é segura.
-- ---------------------------------------------------------------------------
do $$
declare
  v         json;
  v_results jsonb := '[]'::jsonb;
  r         record;
  i         integer;
begin
  for r in
    select x.serie, x.sql
      from jsonb_to_recordset(jsonb_build_array(
        jsonb_build_object(
          'serie', 'payments_can_access_por_linha',
          'sql', $q$explain (analyze, buffers, format json)
                 select count(*) from public.payments p
                  where public._rls_can_access(p.environment)$q$
        ),
        jsonb_build_object(
          'serie', 'payments_initplan_proposto',
          'sql', $q$explain (analyze, buffers, format json)
                 select count(*) from public.payments p
                  where (select public._rls_can_access(null))
                    and (p.environment is null or p.environment = coalesce(
                           nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'environment', ''),
                           'production'))$q$
        ),
        jsonb_build_object(
          'serie', 'clients_can_access_por_linha',
          'sql', $q$explain (analyze, buffers, format json)
                 select count(*) from public.clients c
                  where public._rls_can_access(c.environment)$q$
        ),
        jsonb_build_object(
          'serie', 'clients_initplan_proposto',
          'sql', $q$explain (analyze, buffers, format json)
                 select count(*) from public.clients c
                  where (select public._rls_can_access(null))
                    and (c.environment is null or c.environment = coalesce(
                           nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'environment', ''),
                           'production'))$q$
        ),
        jsonb_build_object(
          'serie', 'contracts_can_access_por_linha',
          'sql', $q$explain (analyze, buffers, format json)
                 select count(*) from public.contracts c
                  where public._rls_can_access(c.environment)$q$
        ),
        jsonb_build_object(
          'serie', 'contracts_initplan_proposto',
          'sql', $q$explain (analyze, buffers, format json)
                 select count(*) from public.contracts c
                  where (select public._rls_can_access(null))
                    and (c.environment is null or c.environment = coalesce(
                           nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'environment', ''),
                           'production'))$q$
        ),
        jsonb_build_object(
          'serie', 'sessao_gate_initplan',
          'sql', $q$explain (analyze, buffers, format json)
                 select (select public._rls_can_access(null))$q$
        )
      )) as x(serie text, sql text)
  loop
    for i in 1..5 loop
      begin
        execute r.sql into v;
        v_results := v_results || jsonb_build_object(
          'serie', r.serie, 'ms', (v->0->>'Execution Time')::numeric, 'erro', null
        );
      exception when others then
        v_results := v_results || jsonb_build_object(
          'serie', r.serie, 'ms', null, 'erro', sqlerrm
        );
      end;
    end loop;
  end loop;

  perform set_config('rlsteste.controle', v_results::text, true);
end $$;

with amostras as (
  select 'atual_com_rls'::text as grupo, x.serie, x.ms, x.erro
    from jsonb_to_recordset(current_setting('rlsteste.atual')::jsonb)
      as x(serie text, ms numeric, erro text)
  union all
  select 'controle_sem_rls', x.serie, x.ms, x.erro
    from jsonb_to_recordset(current_setting('rlsteste.controle')::jsonb)
      as x(serie text, ms numeric, erro text)
), med as (
  select grupo, serie,
         percentile_cont(0.5) within group (order by ms::double precision) as mediana
    from amostras where ms is not null
   group by grupo, serie
)
select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'servidor', current_setting('server_version'),
  'role_app', current_setting('rlsteste.role_app'),
  'sessoes_ativas_recentes', (
    select count(*) from public.user_sessions
     where logout_at is null and last_seen_at > now() - interval '60 seconds'
  ),
  'aviso', case
    when current_setting('request.jwt.claims', true)::jsonb ? 'session_id' then null
    else 'SEM SESSÃO ATIVA: medição inválida.'
  end,
  'repeticoes', 5,
  'mediana_ms', (
    select jsonb_object_agg(grupo || '/' || serie, round(mediana::numeric, 3))
      from med
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

-- BENCHMARK — prova somente leitura do InitPlan nas funções de portal
-- (célula única: comparacao_portal_initplan). 24/11/2026.
-- Termina em ROLLBACK. Nenhum DDL, nenhum UPDATE/DELETE.
--
-- Medição prévia (18:55:50 UTC, docs/BENCHMARK-PORTAL-CLIENTS-20261124.sql):
--   clients com RLS            13,723 ms
--   portal IN com função       13,464 ms
--   portal EXISTS com função   13,604 ms
--   portal IN literal NULL      0,124 ms
--   função isolada              0,240 ms
--   clients sem RLS             0,041 ms
-- Plano: Seq Scan em contracts, 125 linhas filtradas, uma chamada de
-- _rls_portal_indicator_id() POR LINHA (13,4 ms). IN e EXISTS produzem o mesmo
-- plano: o custo não é o semi-join, é a função no filtro.
--
-- Hipótese a provar: trocar
--   c.indicator_id = public._rls_portal_indicator_id()
-- por
--   c.indicator_id = (select public._rls_portal_indicator_id())
-- transforma a função em InitPlan (1 chamada por statement), preservando a
-- semântica porque ela é STABLE.
--
-- Também mede _rls_onboarding_client_id(), que aparece em policies de clients.

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

-- Bloco A — referência com RLS
do $$
declare
  v         json;
  v_results jsonb := '[]'::jsonb;
  r         record;
  i         integer;
begin
  perform set_config('role', 'authenticated', true);

  for r in
    select x.serie, x.sql
      from jsonb_to_recordset($q$[
        {"serie":"clients_com_rls","sql":"explain (analyze, buffers, format json) select count(*) from public.clients"},
        {"serie":"search_all_com_rls","sql":"explain (analyze, buffers, format json) select public.search_all('ana', 'production')"}
      ]$q$::jsonb) as x(serie text, sql text)
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

  perform set_config('bench.pi_com_rls', v_results::text, true);
end $$;

reset role;

-- Bloco B — expressões isoladas, sem RLS
do $$
declare
  v           json;
  v_results   jsonb := '[]'::jsonb;
  v_plano_atu jsonb;
  v_plano_nov jsonb;
  r           record;
  i           integer;
begin
  perform set_config('bench.pi_role_sem_rls', current_user, true);

  for r in
    select x.serie, x.sql
      from jsonb_to_recordset($q$[
        {"serie":"funcao_portal","sql":"explain (analyze, buffers, format json) select public._rls_portal_indicator_id()"},
        {"serie":"funcao_onboarding","sql":"explain (analyze, buffers, format json) select public._rls_onboarding_client_id()"},
        {"serie":"clients_owner","sql":"explain (analyze, buffers, format json) select count(*) from public.clients"},
        {"serie":"portal_clients_atual_in","sql":"explain (analyze, buffers, format json) select count(*) from public.clients c where c.id in (select c2.client_id from public.contracts c2 where c2.indicator_id = public._rls_portal_indicator_id())"},
        {"serie":"portal_clients_initplan_in","sql":"explain (analyze, buffers, format json) select count(*) from public.clients c where c.id in (select c2.client_id from public.contracts c2 where c2.indicator_id = (select public._rls_portal_indicator_id()))"},
        {"serie":"portal_clients_atual_exists","sql":"explain (analyze, buffers, format json) select count(*) from public.clients c where exists (select 1 from public.contracts c2 where c2.client_id = c.id and c2.indicator_id = public._rls_portal_indicator_id())"},
        {"serie":"onboarding_clients_atual","sql":"explain (analyze, buffers, format json) select count(*) from public.clients c where c.id = public._rls_onboarding_client_id()"},
        {"serie":"onboarding_clients_initplan","sql":"explain (analyze, buffers, format json) select count(*) from public.clients c where c.id = (select public._rls_onboarding_client_id())"},
        {"serie":"portal_contracts_atual","sql":"explain (analyze, buffers, format json) select count(*) from public.contracts c where c.indicator_id = public._rls_portal_indicator_id()"},
        {"serie":"portal_contracts_initplan","sql":"explain (analyze, buffers, format json) select count(*) from public.contracts c where c.indicator_id = (select public._rls_portal_indicator_id())"},
        {"serie":"portal_commission_atual","sql":"explain (analyze, buffers, format json) select count(*) from public.commission_payments c where c.indicator_id = public._rls_portal_indicator_id()"},
        {"serie":"portal_commission_initplan","sql":"explain (analyze, buffers, format json) select count(*) from public.commission_payments c where c.indicator_id = (select public._rls_portal_indicator_id())"},
        {"serie":"controle_literal_null","sql":"explain (analyze, buffers, format json) select count(*) from public.clients c where c.id in (select c2.client_id from public.contracts c2 where c2.indicator_id is null)"}
      ]$q$::jsonb) as x(serie text, sql text)
  loop
    for i in 1..5 loop
      begin
        execute r.sql into v;
        v_results := v_results || jsonb_build_object(
          'serie', r.serie, 'ms', (v->0->>'Execution Time')::numeric, 'erro', null
        );

        if i = 1 and r.serie = 'portal_clients_atual_in' then
          v_plano_atu := v;
        end if;
        if i = 1 and r.serie = 'portal_clients_initplan_in' then
          v_plano_nov := v;
        end if;
      exception when others then
        v_results := v_results || jsonb_build_object(
          'serie', r.serie, 'ms', null, 'erro', sqlerrm
        );
      end;
    end loop;
  end loop;

  perform set_config('bench.pi_sem_rls', v_results::text, true);
  perform set_config('bench.pi_plano_atual', coalesce(v_plano_atu, '[]'::jsonb)::text, true);
  perform set_config('bench.pi_plano_novo', coalesce(v_plano_nov, '[]'::jsonb)::text, true);
end $$;

with amostras as (
  select 'com_rls'::text as grupo, x.serie, x.ms, x.erro
    from jsonb_to_recordset(current_setting('bench.pi_com_rls')::jsonb)
      as x(serie text, ms numeric, erro text)
  union all
  select 'sem_rls', x.serie, x.ms, x.erro
    from jsonb_to_recordset(current_setting('bench.pi_sem_rls')::jsonb)
      as x(serie text, ms numeric, erro text)
), med as (
  select grupo, serie,
         round(percentile_cont(0.5) within group (order by ms::double precision)::numeric, 3) as mediana
    from amostras
   where ms is not null
   group by grupo, serie
)
select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'servidor', current_setting('server_version'),
  'role_com_rls', 'authenticated',
  'role_sem_rls', current_setting('bench.pi_role_sem_rls'),
  'repeticoes', 5,
  'sessoes_ativas_recentes', (
    select count(*) from public.user_sessions
     where logout_at is null and last_seen_at > now() - interval '60 seconds'
  ),
  'aviso', case
    when current_setting('request.jwt.claims', true)::jsonb ? 'session_id' then null
    else 'SEM SESSÃO ATIVA: claims vazias; medição inválida.'
  end,
  'referencia_185550_ms', jsonb_build_object(
    'clients_com_rls', 13.723,
    'search_all_com_rls', 21.683,
    'portal_clients_atual_in', 13.464,
    'portal_clients_atual_exists', 13.604,
    'portal_clients_literal_null', 0.124
  ),
  'mediana_ms', (select jsonb_object_agg(grupo || '/' || serie, mediana) from med),
  'contagens', jsonb_build_object(
    'clients', (select count(*) from public.clients),
    'contracts', (select count(*) from public.contracts),
    'commission_payments', (select count(*) from public.commission_payments),
    'indicator_tokens', (select count(*) from public.indicator_tokens),
    'client_onboarding_tokens', (select count(*) from public.client_onboarding_tokens)
  ),
  'plano_atual', current_setting('bench.pi_plano_atual')::jsonb,
  'plano_initplan', current_setting('bench.pi_plano_novo')::jsonb,
  'erros', (
    select coalesce(jsonb_agg(jsonb_build_object('serie', serie, 'erro', erro)), '[]'::jsonb)
      from amostras where erro is not null
  ),
  'series', (
    select coalesce(jsonb_agg(
             jsonb_build_object('grupo', grupo, 'serie', serie, 'ms', ms, 'erro', erro)
             order by grupo, serie), '[]'::jsonb)
      from amostras
  )
)) as comparacao_portal_initplan;

rollback;

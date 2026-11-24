-- BENCHMARK — resíduo de RLS em clients / policy do portal (célula única:
-- comparacao_portal). 24/11/2026. Somente leitura; termina em ROLLBACK.
--
-- Contexto: após FORWARD + FIX, payments/contracts/installments caíram para
-- ~1 ms, mas clients ficou em 13,720 ms (baseline 163,286 ms). search_all
-- (21,253 ms) e vw_dashboard_top_defaulters (15,644 ms) fazem JOIN/busca em
-- clients — a suspeita é a policy 'P0 portal indicador'.
--
-- Este script NÃO muda nada. Ele separa:
--   1) RLS real de clients/contracts com role authenticated;
--   2) o custo da função _rls_portal_indicator_id();
--   3) o predicado IN usado hoje na policy, com e sem a função;
--   4) o predicado EXISTS original, com e sem a função;
--   5) os planos de IN e EXISTS para ver se a subconsulta é reavaliada.
--
-- Rodar com uma aba do sistema aberta (sessão ativa). Arquivo INTEIRO.

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
-- Bloco A — role da aplicação (RLS ativo)
-- ---------------------------------------------------------------------------
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
        {"serie":"contracts_com_rls","sql":"explain (analyze, buffers, format json) select count(*) from public.contracts"},
        {"serie":"search_all_com_rls","sql":"explain (analyze, buffers, format json) select public.search_all('ana', 'production')"}
      ]$q$::jsonb) as x(serie text, sql text)
  loop
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
          'serie', r.serie, 'ms', null, 'erro', sqlerrm
        );
      end;
    end loop;
  end loop;

  perform set_config('bench.portal_com_rls', v_results::text, true);
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Bloco B — mesmo predicates sem RLS (role dono do SQL Editor): isola o custo
-- da policy do portal, sem a policy 'P0 sessao' junto.
-- ---------------------------------------------------------------------------
do $$
declare
  v           json;
  v_results   jsonb := '[]'::jsonb;
  v_plano_in  jsonb;
  v_plano_ex  jsonb;
  r           record;
  i           integer;
begin
  perform set_config('bench.portal_role_sem_rls', current_user, true);

  for r in
    select x.serie, x.sql
      from jsonb_to_recordset($q$[
        {"serie":"clients_owner","sql":"explain (analyze, buffers, format json) select count(*) from public.clients"},
        {"serie":"portal_indicator_id","sql":"explain (analyze, buffers, format json) select public._rls_portal_indicator_id()"},
        {"serie":"portal_in_com_funcao","sql":"explain (analyze, buffers, format json) select count(*) from public.clients c where c.id in (select c2.client_id from public.contracts c2 where c2.indicator_id = public._rls_portal_indicator_id())"},
        {"serie":"portal_in_literal_null","sql":"explain (analyze, buffers, format json) select count(*) from public.clients c where c.id in (select c2.client_id from public.contracts c2 where c2.indicator_id is null)"},
        {"serie":"portal_exists_com_funcao","sql":"explain (analyze, buffers, format json) select count(*) from public.clients c where exists (select 1 from public.contracts c2 where c2.client_id = c.id and c2.indicator_id = public._rls_portal_indicator_id())"},
        {"serie":"portal_exists_literal_null","sql":"explain (analyze, buffers, format json) select count(*) from public.clients c where exists (select 1 from public.contracts c2 where c2.client_id = c.id and c2.indicator_id is null)"}
      ]$q$::jsonb) as x(serie text, sql text)
  loop
    for i in 1..5 loop
      begin
        execute r.sql into v;
        v_results := v_results || jsonb_build_object(
          'serie', r.serie,
          'ms', (v->0->>'Execution Time')::numeric,
          'erro', null
        );

        if i = 1 and r.serie = 'portal_in_com_funcao' then
          v_plano_in := v;
        end if;
        if i = 1 and r.serie = 'portal_exists_com_funcao' then
          v_plano_ex := v;
        end if;
      exception when others then
        v_results := v_results || jsonb_build_object(
          'serie', r.serie, 'ms', null, 'erro', sqlerrm
        );
      end;
    end loop;
  end loop;

  perform set_config('bench.portal_sem_rls', v_results::text, true);
  perform set_config('bench.portal_plano_in', coalesce(v_plano_in, '[]'::jsonb)::text, true);
  perform set_config('bench.portal_plano_exists', coalesce(v_plano_ex, '[]'::jsonb)::text, true);
end $$;

-- ---------------------------------------------------------------------------
-- Resultado único
-- ---------------------------------------------------------------------------
with amostras as (
  select 'com_rls'::text as grupo, x.serie, x.ms, x.erro
    from jsonb_to_recordset(current_setting('bench.portal_com_rls')::jsonb)
      as x(serie text, ms numeric, erro text)
  union all
  select 'sem_rls', x.serie, x.ms, x.erro
    from jsonb_to_recordset(current_setting('bench.portal_sem_rls')::jsonb)
      as x(serie text, ms numeric, erro text)
), med as (
  select grupo, serie,
         round(percentile_cont(0.5) within group (order by ms::double precision)::numeric, 3) as mediana,
         count(*) filter (where ms is not null) as n_ok
    from amostras
   where ms is not null
   group by grupo, serie
)
select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'servidor', current_setting('server_version'),
  'role_com_rls', 'authenticated',
  'role_sem_rls', current_setting('bench.portal_role_sem_rls'),
  'repeticoes', 5,
  'sessoes_ativas_recentes', (
    select count(*) from public.user_sessions
     where logout_at is null and last_seen_at > now() - interval '60 seconds'
  ),
  'aviso', case
    when current_setting('request.jwt.claims', true)::jsonb ? 'session_id' then null
    else 'SEM SESSÃO ATIVA: claims vazias; medição inválida.'
  end,
  'referencia_185252_ms', jsonb_build_object(
    'clients_com_rls', 13.720,
    'search_all_com_rls', 21.253,
    'vw_dashboard_top_defaulters_com_rls', 15.644
  ),
  'mediana_ms', (
    select jsonb_object_agg(grupo || '/' || serie, mediana) from med
  ),
  'contagens', jsonb_build_object(
    'clients', (select count(*) from public.clients),
    'contracts', (select count(*) from public.contracts),
    'indicator_tokens', (select count(*) from public.indicator_tokens)
  ),
  'plano_in_com_funcao', current_setting('bench.portal_plano_in')::jsonb,
  'plano_exists_com_funcao', current_setting('bench.portal_plano_exists')::jsonb,
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
)) as comparacao_portal;

rollback;

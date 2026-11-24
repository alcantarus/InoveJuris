-- FORWARD — RLS com InitPlan (NÃO APLICAR SEM AUTORIZAÇÃO EXPLÍCITA)
-- 24/11/2026
--
-- Pré-requisito: docs/BENCHMARK-RLS-INIPLAN-20261124.sql executado às
-- 18:44:42 UTC. Resultado: 111,542 -> 1,026 ms em payments,
-- 79,464 -> 0,960 ms em contracts, 71,753 -> 0,920 ms em clients.
--
-- O que faz: reescreve TODA policy de public que chama _rls_can_access,
-- preservando exatamente a semântica:
--
--   _rls_can_access(environment)
--     = _rls_session_valid()
--       AND (environment IS NULL OR environment = _rls_environment())
--
--   => ((select public._rls_can_access(null))                    [InitPlan]
--       AND (environment IS NULL
--            OR environment = coalesce(
--                 nullif(current_setting('request.jwt.claims', true)::jsonb
--                          ->> 'environment', ''), 'production')))
--
-- e _rls_can_access(null) => (select public._rls_can_access(null)).
--
-- Também troca o EXISTS por linha na policy do portal em clients por um IN
-- (semi-join), equivalente e muito mais barato.
--
-- Nenhum UPDATE/DELETE. Nenhuma grant nova. Nenhuma função nova.
-- Rollback: docs/ROLLBACK-RLS-INIPLAN-20261124.sql

do $$
declare
  r        record;
  v_using  text;
  v_check  text;
  v_roles  text;
begin
  for r in
    select schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (
         qual ilike '%_rls_can_access%'
         or with_check ilike '%_rls_can_access%'
         or (tablename = 'clients' and policyname = 'P0 portal indicador')
       )
     order by tablename, policyname
  loop
    v_using := r.qual;
    v_check := r.with_check;

    -- 1) Argumento NULL: uma chamada por statement via subconsulta não correlacionada.
    v_using := regexp_replace(
      v_using,
      '(public\.)?_rls_can_access\(\s*null\s*\)',
      '(select public._rls_can_access(null))',
      'gi'
    );
    v_check := regexp_replace(
      v_check,
      '(public\.)?_rls_can_access\(\s*null\s*\)',
      '(select public._rls_can_access(null))',
      'gi'
    );

    -- 2) Argumento = coluna environment: validação no InitPlan + comparação SQL.
    --    A ordem importa: o texto inserido em 1) contém _rls_can_access(null).
    v_using := regexp_replace(
      v_using,
      '(public\.)?_rls_can_access\(\s*environment\s*\)',
      '((select public._rls_can_access(null)) AND (environment IS NULL OR environment = coalesce(nullif(current_setting(''request.jwt.claims'', true)::jsonb ->> ''environment'', ''''), ''production'')))',
      'gi'
    );
    v_check := regexp_replace(
      v_check,
      '(public\.)?_rls_can_access\(\s*environment\s*\)',
      '((select public._rls_can_access(null)) AND (environment IS NULL OR environment = coalesce(nullif(current_setting(''request.jwt.claims'', true)::jsonb ->> ''environment'', ''''), ''production'')))',
      'gi'
    );

    -- 3) Portal do indicador em clients: EXISTS correlacionado -> IN (semi-join).
    if r.tablename = 'clients'
       and r.policyname = 'P0 portal indicador'
       and r.qual ilike '%exists%contracts%_rls_portal_indicator_id%' then
      v_using := 'clients.id in (select c.client_id from public.contracts c where c.indicator_id = public._rls_portal_indicator_id())';
    end if;

    if v_using is distinct from r.qual or v_check is distinct from r.with_check then
      v_roles := coalesce(nullif(array_to_string(r.roles, ', '), ''), 'public');

      execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
      execute format(
        'create policy %I on %I.%I %sfor %s to %s%s%s',
        r.policyname,
        r.schemaname,
        r.tablename,
        case when r.permissive = 'RESTRICTIVE' then 'as restrictive ' else '' end,
        r.cmd,
        v_roles,
        case when v_using is not null then format(' using (%s)', v_using) else '' end,
        case when v_check is not null then format(' with check (%s)', v_check) else '' end
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload config';

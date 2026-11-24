-- FORWARD — InitPlan nas policies do portal (NÃO APLICAR SEM AUTORIZAÇÃO)
-- 24/11/2026
--
-- Pré-requisito: docs/BENCHMARK-PORTAL-INIPLAN-20261124.sql executado às
-- 18:58:19 UTC. Resultado:
--   portal clients      14,084 -> 0,328 ms
--   portal contracts    13,913 -> 0,286 ms
--   portal commission    1,700 -> 0,241 ms
--   onboarding clients   0,125 -> 0,149 ms (sem ganho: NÃO incluído)
-- Plano atual: 125 chamadas de _rls_portal_indicator_id() no filtro.
-- Plano proposto: InitPlan 1, uma chamada.
--
-- O que faz: em toda policy de public que chama _rls_portal_indicator_id(),
-- troca a chamada direta por (select public._rls_portal_indicator_id()).
-- A função é STABLE, então o valor é o mesmo dentro do statement.
-- Nenhuma grant nova, nenhuma função nova, nenhum UPDATE/DELETE.
-- Rollback: docs/ROLLBACK-PORTAL-INIPLAN-20261124.sql

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
         coalesce(qual, '') ilike '%_rls_portal_indicator_id%'
         or coalesce(with_check, '') ilike '%_rls_portal_indicator_id%'
       )
     order by tablename, policyname
  loop
    v_using := r.qual;
    v_check := r.with_check;

    -- O texto normalizado do InitPlan contém
    -- "( SELECT _rls_portal_indicator_id() AS _rls_portal_indicator_id)".
    -- Não pode ser reescrito como chamada direta.
    if v_using is not null and v_using not ilike '%SELECT _rls_portal_indicator_id%' then
      v_using := regexp_replace(
        v_using,
        '(public\.)?_rls_portal_indicator_id\(\s*\)',
        '(select public._rls_portal_indicator_id())',
        'gi'
      );
    end if;

    if v_check is not null and v_check not ilike '%SELECT _rls_portal_indicator_id%' then
      v_check := regexp_replace(
        v_check,
        '(public\.)?_rls_portal_indicator_id\(\s*\)',
        '(select public._rls_portal_indicator_id())',
        'gi'
      );
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

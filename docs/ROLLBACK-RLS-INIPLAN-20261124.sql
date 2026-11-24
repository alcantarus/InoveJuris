-- ROLLBACK — RLS com InitPlan (NÃO APLICAR SEM AUTORIZAÇÃO EXPLÍCITA)
-- 24/11/2026
--
-- Reverte exatamente as transformações de
-- docs/FORWARD-RLS-INIPLAN-20261124.sql, inclusive a policy do portal em
-- clients. Nenhum UPDATE/DELETE.

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

    -- 1) Desfaz primeiro a forma com coluna: ela contém _rls_can_access(null).
    v_using := regexp_replace(
      v_using,
      '\(\(select public\._rls_can_access\(null\)\) AND \(environment IS NULL OR environment = coalesce\(nullif\(current_setting\(''request.jwt.claims'', true\)::jsonb ->> ''environment'', ''''\), ''production''\)\)\)',
      'public._rls_can_access(environment)',
      'gi'
    );
    v_check := regexp_replace(
      v_check,
      '\(\(select public\._rls_can_access\(null\)\) AND \(environment IS NULL OR environment = coalesce\(nullif\(current_setting\(''request.jwt.claims'', true\)::jsonb ->> ''environment'', ''''\), ''production''\)\)\)',
      'public._rls_can_access(environment)',
      'gi'
    );

    -- 2) Desfaz a forma sem coluna.
    v_using := regexp_replace(
      v_using,
      '\(select public\._rls_can_access\(null\)\)',
      'public._rls_can_access(null)',
      'gi'
    );
    v_check := regexp_replace(
      v_check,
      '\(select public\._rls_can_access\(null\)\)',
      'public._rls_can_access(null)',
      'gi'
    );

    -- 3) Restaura o EXISTS original do portal em clients.
    if r.tablename = 'clients' and r.policyname = 'P0 portal indicador' then
      v_using := 'exists (select 1 from public.contracts c where c.client_id = clients.id and c.indicator_id = public._rls_portal_indicator_id())';
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

-- ROLLBACK — InitPlan nas policies do portal (NÃO APLICAR SEM AUTORIZAÇÃO)
-- 24/11/2026
--
-- Reverte exatamente docs/FORWARD-PORTAL-INIPLAN-20261124.sql, reconstruindo
-- a partir da marca normalizada do catálogo. Não toca policies nunca
-- convertidas. Nenhum UPDATE/DELETE.
--
-- InitPlan normalizado:
--   ( SELECT _rls_portal_indicator_id() AS _rls_portal_indicator_id)
-- Forma original:
--   _rls_portal_indicator_id()

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

    if r.qual ilike '%SELECT _rls_portal_indicator_id%' then
      v_using := regexp_replace(
        v_using,
        '\(\s*SELECT\s+(public\.)?_rls_portal_indicator_id\(\s*\)\s+AS\s+_rls_portal_indicator_id\)',
        '_rls_portal_indicator_id()',
        'gi'
      );
    end if;

    if r.with_check ilike '%SELECT _rls_portal_indicator_id%' then
      v_check := regexp_replace(
        v_check,
        '\(\s*SELECT\s+(public\.)?_rls_portal_indicator_id\(\s*\)\s+AS\s+_rls_portal_indicator_id\)',
        '_rls_portal_indicator_id()',
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

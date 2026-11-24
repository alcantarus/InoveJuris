-- ROLLBACK — RLS com InitPlan (NÃO APLICAR SEM AUTORIZAÇÃO EXPLÍCITA)
-- 24/11/2026. Versão corrigida: reconstrução pelas marcas do catálogo,
-- não por texto não normalizado digitado à mão.
--
-- Reverte FORWARD + FIX, inclusive a policy do portal em clients.
-- Não toca policies que nunca foram convertidas. Nenhum UPDATE/DELETE.
--
-- Marcas normalizadas pelo PostgreSQL 17:
--   InitPlan: ( SELECT _rls_can_access(NULL::text) AS _rls_can_access)
--   Sem coluna -> _rls_can_access(NULL::text)
--   Com coluna -> _rls_can_access(environment)
--   Portal clients -> EXISTS correlacionado original.

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
         coalesce(qual, '') ilike '%_rls_can_access%'
         or coalesce(with_check, '') ilike '%_rls_can_access%'
         or (tablename = 'clients' and policyname = 'P0 portal indicador')
       )
     order by tablename, policyname
  loop
    v_using := r.qual;
    v_check := r.with_check;

    -- using: reconstrói apenas se houver InitPlan (foi convertida).
    if r.qual ilike '%SELECT _rls_can_access%' then
      v_using := case
        when r.qual ilike '%environment IS NULL%'
          then '_rls_can_access(environment)'
        else '_rls_can_access(NULL::text)'
      end;

      -- Portal (contracts, commission_payments) tinha o predicado extra.
      if r.qual ilike '%indicator_id = _rls_portal_indicator_id%' then
        v_using := v_using || ' AND indicator_id = _rls_portal_indicator_id()';
      end if;
    end if;

    -- with check: mesma reconstrução, com as marcas do próprio campo.
    if r.with_check ilike '%SELECT _rls_can_access%' then
      v_check := case
        when r.with_check ilike '%environment IS NULL%'
          then '_rls_can_access(environment)'
        else '_rls_can_access(NULL::text)'
      end;

      if r.with_check ilike '%indicator_id = _rls_portal_indicator_id%' then
        v_check := v_check || ' AND indicator_id = _rls_portal_indicator_id()';
      end if;
    end if;

    -- Portal do indicador em clients: IN (semi-join) -> EXISTS correlacionado.
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

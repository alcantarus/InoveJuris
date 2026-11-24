-- FIX — policies remanescentes de RLS InitPlan (NÃO APLICAR SEM AUTORIZAÇÃO)
-- 24/11/2026
--
-- Motivo: das 55 policies com _rls_can_access, o FORWARD converteu 47 e
-- deixou 8 porque o PostgreSQL normalizou os argumentos no catálogo:
--   _rls_can_access(NULL::text)            (6 policies)
--   _rls_can_access((environment)::text)   (2 policies)
-- O verify de 18:47:25 UTC mostrou essas formas ainda presentes em
-- backup_logs, contract_diseases, installment_history, integration_logs,
-- organizations, system_settings, task_history e user_organizations.
--
-- Converte somente expressões que ainda NÃO contêm o InitPlan. A proteção é
-- por campo: o texto normalizado do InitPlan contém
-- "_rls_can_access(NULL::text)" e não pode ser reescrito como chamada direta.
-- Mesma expressão, mesmas regras, nenhum UPDATE/DELETE.

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
       )
     order by tablename, policyname
  loop
    v_using := r.qual;
    v_check := r.with_check;

    -- 1) NULL (com ou sem cast ::text) -> uma chamada por statement.
    --    Feito antes do environment.
    if v_using is not null and v_using not ilike '%SELECT _rls_can_access%' then
      v_using := regexp_replace(
        v_using,
        '(public\.)?_rls_can_access\(\s*null\s*(::\s*\w+\s*)?\)',
        '(select public._rls_can_access(null))',
        'gi'
      );

      -- 2) environment (com parênteses e/ou cast) -> InitPlan + comparação SQL.
      v_using := regexp_replace(
        v_using,
        '(public\.)?_rls_can_access\(\s*\(?\s*environment\s*\)?\s*(::\s*\w+\s*)?\)',
        '((select public._rls_can_access(null)) AND (environment IS NULL OR environment = coalesce(nullif(current_setting(''request.jwt.claims'', true)::jsonb ->> ''environment'', ''''), ''production'')))',
        'gi'
      );
    end if;

    if v_check is not null and v_check not ilike '%SELECT _rls_can_access%' then
      v_check := regexp_replace(
        v_check,
        '(public\.)?_rls_can_access\(\s*null\s*(::\s*\w+\s*)?\)',
        '(select public._rls_can_access(null))',
        'gi'
      );
      v_check := regexp_replace(
        v_check,
        '(public\.)?_rls_can_access\(\s*\(?\s*environment\s*\)?\s*(::\s*\w+\s*)?\)',
        '((select public._rls_can_access(null)) AND (environment IS NULL OR environment = coalesce(nullif(current_setting(''request.jwt.claims'', true)::jsonb ->> ''environment'', ''''), ''production'')))',
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

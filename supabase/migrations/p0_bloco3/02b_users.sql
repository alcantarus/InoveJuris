-- Lote 02b — tabela users
--
-- Diagnóstico em produção (23/11/2026): três policies SELECT em users:
--   1. "Users can read users"                     USING (true) -> permissiva
--   2. "Authenticated read access to users"       auth.role() = 'authenticated'
--                                                 -> permissiva disfarçada
--   3. "Isolamento por Organização em users"      organization_id = get_auth_organization()
--                                                 OR is_superadmin = true -> restritiva
--
-- As duas primeiras são removidas. A terceira é PRESERVADA.
-- A policy P0 é criada como AS RESTRICTIVE para ser combinada (AND) com a de
-- organização, em vez de substituí-la por OR (o que quebraria o isolamento).
-- Escrita em users já passa por RPCs SECURITY DEFINER no servidor.

do $$
begin
  perform public._p0_drop_except(
    array['users'],
    array['Isolamento por Organização em users']
  );

  execute format('drop policy if exists %I on public.users', 'P0 sessao restritiva');

  execute format($f$
    create policy %I on public.users
      as restrictive
      for select to anon, authenticated
      using (public._rls_can_access(environment))
  $f$, 'P0 sessao restritiva');
end $$;

-- Verificação: esperado exatamente 2 policies SELECT em users.
-- select policyname, permissive, qual from pg_policies
-- where schemaname = 'public' and tablename = 'users'
-- order by policyname;

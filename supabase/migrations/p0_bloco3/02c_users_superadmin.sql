-- Lote 02c — superadministrador enxerga todos os usuários
--
-- A policy preservada "Isolamento por Organização em users" usa
--   organization_id = get_auth_organization() OR is_superadmin = true
-- onde `is_superadmin` é o flag DA LINHA (usuário lido), não de quem consulta.
-- Com a policy permissiva antiga removida no lote 02b, quem está logado como
-- superadmin passou a ver apenas as linhas da própria organização (e as que
-- já eram superadmin), escondendo os demais usuários.
--
-- Solução: policy permissiva adicional baseada na claim do chamador
-- (`_rls_is_superadmin()`). Policies permissivas são combinadas com OR, então:
--   - superadmin  -> vê todas as linhas do ambiente
--   - demais      -> continuam restritos à organização
-- A policy restritiva "P0 sessao restritiva" continua exigindo sessão válida
-- e o mesmo environment.

-- _rls_is_superadmin() é SECURITY DEFINER e só lê a claim do JWT; precisa de
-- EXECUTE para ser usada dentro da policy.
grant execute on function public._rls_is_superadmin() to anon, authenticated;

do $$
begin
  execute format('drop policy if exists %I on public.users', 'P0 superadmin leitura');

  execute format($f$
    create policy %I on public.users
      for select to anon, authenticated
      using (public._rls_is_superadmin())
  $f$, 'P0 superadmin leitura');
end $$;

-- Verificação: esperado 3 policies SELECT em users.
-- select policyname, permissive, qual from pg_policies
-- where schemaname = 'public' and tablename = 'users'
-- order by policyname;

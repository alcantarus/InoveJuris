-- Lote 01 — tabelas internas de autenticação
--
-- Nenhuma tela lê estas tabelas diretamente: sessão, desafios e dispositivos
-- são manipulados pelas RPCs SECURITY DEFINER da Fase A. Portanto a policy
-- permissiva é removida e NÃO é substituída: anon/authenticated não acessam.
-- service_role e as RPCs continuam funcionando.

do $$
begin
  perform public._p0_drop_permissive(array[
    'user_sessions',
    'login_challenges',
    'trusted_devices'
  ]);
end $$;

-- Verificação do lote (esperado: 0 linhas com qual/with_check = true e
-- nenhuma policy "P0 sessao" nas três tabelas):
-- select tablename, policyname, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('user_sessions','login_challenges','trusted_devices')
-- order by tablename, policyname;

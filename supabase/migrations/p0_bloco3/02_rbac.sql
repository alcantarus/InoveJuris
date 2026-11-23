-- Lote 02 — RBAC
--
-- Leitura permitida apenas com sessão válida. Toda escrita já passa pelas
-- RPCs SECURITY DEFINER (app_admin_save_user, app_admin_save_role etc.),
-- executadas no servidor com service_role; o navegador não grava mais nestas
-- tabelas.
--
-- `users` fica FORA deste lote: existe uma policy de organização preservada
-- da F4b que precisa ser inspecionada antes de receber a policy P0, para não
-- criar uma segunda policy permissiva que a anule.

do $$
begin
  perform public._p0_drop_permissive(array[
    'roles', 'permissions', 'role_permissions', 'user_roles'
  ]);
  perform public._p0_apply_readonly(array[
    'roles', 'permissions', 'role_permissions', 'user_roles'
  ]);
end $$;

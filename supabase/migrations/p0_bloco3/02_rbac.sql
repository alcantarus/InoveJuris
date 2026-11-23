-- Lote 02 — usuários e RBAC
--
-- Leitura permitida apenas com sessão válida. Toda escrita já passa pelas
-- RPCs SECURITY DEFINER (app_admin_save_user, app_admin_save_role etc.),
-- executadas no servidor com service_role; o navegador não grava mais nestas
-- tabelas.

do $$
begin
  perform public._p0_drop_permissive(array[
    'users', 'roles', 'permissions', 'role_permissions', 'user_roles'
  ]);
  perform public._p0_apply_readonly(array[
    'users', 'roles', 'permissions', 'role_permissions', 'user_roles'
  ]);
end $$;

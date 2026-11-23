-- P2 / Lote 03 — remover o EXECUTE das funções app_* de auth/sessão/admin do anon.
--
-- Depois do lote 02, as rotas de servidor chamam estas funções com service_role.
-- Não há mais nenhuma chamada do navegador a elas: o cliente usa apenas
-- set_app_environment, app_touch_indicator_token, app_mark_onboarding_used e
-- app_register_commission_payment (esta última como authenticated).
--
-- Para cada função de auth/sessão/admin (todas as sobrecargas):
--   1. REVOKE EXECUTE FROM PUBLIC, anon -> anon perde o acesso de vez;
--   2. GRANT EXECUTE TO authenticated, service_role -> logados e servidor
--      continuam funcionando (o padrão do P1, 04b).
--
-- NÃO estão nesta lista (devem continuar com anon):
--   - app_touch_indicator_token (portal do indicador)
--   - app_mark_onboarding_used (onboarding)
--   - set_app_environment / helpers de RLS / get_auth_organization /
--     log_audit_event / _auth_require_superadmin
-- As funções app_get_rbac/app_admin_save_role/app_admin_delete_role/
-- app_admin_set_role_permission já são service_role-only (não precisam mudar).
--
-- Idempotente: pode rodar mais de uma vez.

do $$
declare
  f record;
  v_names text[] := array[
    'app_authenticate',
    'app_complete_login',
    'app_validate_session',
    'app_heartbeat',
    'app_logout',
    'app_logout_all_user_sessions',
    'app_switch_environment',
    'app_admin_save_user',
    'app_admin_delete_user',
    'app_admin_impersonate',
    'app_admin_terminate_session',
    'app_admin_trust_device',
    'app_get_security_data',
    'app_get_my_trusted_devices',
    'app_remove_my_trusted_device'
  ];
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(v_names)
  loop
    execute format(
      'revoke execute on function public.%I(%s) from public, anon',
      f.proname, f.args
    );
    execute format(
      'grant execute on function public.%I(%s) to authenticated, service_role',
      f.proname, f.args
    );
  end loop;
end $$;

notify pgrst, 'reload schema';

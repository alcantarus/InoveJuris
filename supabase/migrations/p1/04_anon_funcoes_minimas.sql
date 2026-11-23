-- P1 / Lote 04 — reduzir o EXECUTE do papel anon ao mínimo.
--
-- Inventário (lote 03) mostrou 103 funções executáveis por anon. Depois de
-- cruzar com o código, separamos em três grupos:
--
-- 1) MANTER (não revogar) — usadas por fluxos que rodam como anon:
--    * Helpers de RLS: _rls_access_token, _rls_can_access, _rls_is_superadmin,
--      _rls_onboarding_client_id, _rls_portal_indicator_id.
--    * Helpers de guarda/auditoria: _auth_require_superadmin,
--      get_auth_organization, log_audit_event (trigger; anon atualiza clients).
--    * RPCs de autenticação/sessão/admin: app_authenticate, app_complete_login,
--      app_validate_session, app_heartbeat, app_logout,
--      app_logout_all_user_sessions, app_switch_environment, app_admin_save_user,
--      app_admin_delete_user, app_admin_impersonate, app_admin_terminate_session,
--      app_admin_trust_device, app_get_security_data, app_get_my_trusted_devices,
--      app_remove_my_trusted_device.
--      IMPORTANTE: as rotas de servidor (app/api/auth/session, lib/server-auth,
--      app/api/ai/generate) usam a chave ANON, não service_role. Por isso essas
--      funções PRECISAM continuar executáveis por anon. Elas são SECURITY
--      DEFINER e validam a sessão/superadmin internamente pelo p_session_id.
--    * Links públicos: app_mark_onboarding_used, app_touch_indicator_token.
--    * Proxy de ambiente: set_app_environment.
--
-- 2) REVOGAR (este lote) — funções de negócio chamadas apenas por usuários
--    logados (role=authenticated). Revogar de anon não afeta logados nem os
--    links públicos. Todas têm grant explícito a anon (não via PUBLIC).
--
-- 3) DEIXAR PARA P2 — funções de extensão concedidas a PUBLIC (http_*, pg_trgm,
--    unaccent, gin/gtrgm). Revogar só de anon NÃO tem efeito enquanto o grant a
--    PUBLIC existir; exigiria REVOKE FROM PUBLIC + regrant. O http (SSRF) será
--    tratado no P2. Os utilitários inocentes (bytea_to_text, text_to_bytea,
--    get_date_from_ts, immutable_unaccent) ficam como estão.
--
-- Usuários logados (authenticated) e service_role NÃO são afetados.

do $$
declare
  f record;
  v_revoke text[] := array[
    'search_all',
    'search_clients',
    'search_clients_accent_insensitive',
    'search_clients_basic',
    'get_clients_with_process_summary',
    'get_financial_chart_data',
    'get_financial_summary',
    'get_future_receivables_projection',
    'confirm_process_deadline',
    'create_process_deadline',
    'delete_process_deadline',
    'process_contract_cancellation',
    'process_installment_estorno',
    'process_installment_payment',
    'reverse_installment_payment',
    'rpc_receber_parcela_com_metodo',
    'rpc_recebimento_com_desdobramento',
    'save_client_guardians',
    'check_database_orphans',
    'djen_fetch',
    'normalize_deadline_at'
  ];
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(v_revoke)
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    execute format(
      'revoke execute on function public.%I(%s) from anon',
      f.proname, f.args
    );
  end loop;
end $$;

notify pgrst, 'reload schema';

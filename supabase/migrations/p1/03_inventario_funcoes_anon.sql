-- P1 / Lote 03 — inventário de funções que o papel anon pode executar.
--
-- Este arquivo NÃO altera nada. Rode a consulta e guarde o resultado.
-- Depois decidimos o que revogar, preservando:
--   * helpers usados pelas policies (_rls_*);
--   * set_app_environment, chamado pelo cliente Supabase;
--   * app_touch_indicator_token e app_mark_onboarding_used (links públicos).
--
-- Suspeita principal: search_all é SECURITY INVOKER e lê várias tabelas;
-- não deveria ser executável por anon.

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
order by p.proname, args;

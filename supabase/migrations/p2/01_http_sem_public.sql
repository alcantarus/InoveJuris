-- P2 / Lote 01 — remover o grant a PUBLIC das funções http_* (superfície de SSRF).
--
-- As funções da extensão pg_http (http, http_get, http_post, http_put,
-- http_delete, http_patch, http_head, http_header, http_set_curlopt, etc.)
-- nascem com EXECUTE concedido a PUBLIC. Isso deixa anon (e qualquer papel)
-- capaz de fazer o Postgres emitir requisições HTTP a URLs arbitrárias pelo
-- egress do banco — um vetor de SSRF.
--
-- Único consumidor real: public.djen_fetch(text), que é SECURITY DEFINER
-- (executa como o dono, postgres) e chama apenas public.http_get(varchar) com
-- host/caminho FIXOS no DJEN. Nenhum código chama http_* diretamente.
--
-- Este lote, para cada função http_* no schema public:
--   1. REVOKE EXECUTE FROM PUBLIC, anon, authenticated;
--   2. GRANT EXECUTE TO service_role, postgres e ao dono da djen_fetch.
-- Assim a djen_fetch (definer) continua funcionando, e anon/authenticated perdem
-- a capacidade de SSRF. Idempotente.
--
-- Não altera a djen_fetch em si (segue concedida a anon/authenticated/service_role).
--
-- IMPORTANTE: as funções http_* pertencem a supabase_admin (dono da extensão).
-- Um REVOKE feito como postgres é no-op, pois só remove grants do próprio
-- executor. Por isso assumimos supabase_admin via SET ROLE antes de revogar.

set role supabase_admin;

do $$
declare
  f record;
  v_djen_owner text;
begin
  -- Dono da djen_fetch: o SECURITY DEFINER executa como este papel.
  select pg_get_userbyid(p.proowner) into v_djen_owner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'djen_fetch'
  limit 1;

  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname = 'http' or p.proname like 'http\_%')
  loop
    execute format(
      'revoke execute on function public.%I(%s) from public, anon, authenticated',
      f.proname, f.args
    );
    execute format(
      'grant execute on function public.%I(%s) to service_role, postgres',
      f.proname, f.args
    );
    if v_djen_owner is not null and v_djen_owner <> 'postgres' then
      execute format(
        'grant execute on function public.%I(%s) to %I',
        f.proname, f.args, v_djen_owner
      );
    end if;
  end loop;
end $$;

reset role;

notify pgrst, 'reload schema';

-- Lote 12 — menor privilégio nas tabelas de token de link público.
--
-- Problema: as policies do lote 10 eram `FOR ALL` com
--   token = _rls_access_token() OR _rls_can_access(environment)
-- Isso dava ao titular do link permissão de UPDATE/DELETE na própria linha.
-- Em `indicator_tokens`, bastava trocar `indicator_id` (mantendo o `token`)
-- para passar a ver comissões de OUTRO indicador. Em
-- `client_onboarding_tokens`, bastava trocar `client_id` para editar outro
-- cliente, porque `P0 onboarding escrita` deriva o cliente do token.
--
-- Correção:
--   1) token público  -> somente SELECT da própria linha;
--   2) painel logado  -> ALL, com sessão válida e mesmo environment;
--   3) marcar onboarding como usado -> RPC SECURITY DEFINER, sem UPDATE
--      direto do navegador na tabela de token.

-- RPC para o fluxo de onboarding. Roda como owner (bypassa RLS), mas só
-- aceita o token recebido e só marca como usado se ainda estiver válido.
create or replace function public.app_mark_onboarding_used(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ok boolean;
begin
  update public.client_onboarding_tokens
     set used = true
   where token = p_token
     and coalesce(used, false) = false
     and (expires_at is null or expires_at > now())
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.app_mark_onboarding_used(text) from public;
grant execute on function public.app_mark_onboarding_used(text) to anon, authenticated;

do $$
begin
  -- Remove as duas policies FOR ALL do lote 10.
  execute format('drop policy if exists %I on public.indicator_tokens', 'P0 link indicador');
  execute format('drop policy if exists %I on public.client_onboarding_tokens', 'P0 link onboarding');

  -- Leitura pública: somente a linha cujo token foi enviado no header.
  execute format($f$
    create policy %I on public.indicator_tokens
      for select to anon, authenticated
      using (token = public._rls_access_token())
  $f$, 'P0 link indicador leitura');

  execute format($f$
    create policy %I on public.client_onboarding_tokens
      for select to anon, authenticated
      using (token = public._rls_access_token())
  $f$, 'P0 link onboarding leitura');

  -- Escrita: somente sessão válida do painel (nunca o titular do link).
  execute format($f$
    create policy %I on public.indicator_tokens
      for all to anon, authenticated
      using (public._rls_can_access(environment))
      with check (public._rls_can_access(environment))
  $f$, 'P0 token administrador');

  execute format($f$
    create policy %I on public.client_onboarding_tokens
      for all to anon, authenticated
      using (public._rls_can_access(environment))
      with check (public._rls_can_access(environment))
  $f$, 'P0 token administrador');
end $$;

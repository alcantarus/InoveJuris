-- Lote 10 — links públicos (onboarding de cliente e portal do indicador)
--
-- AQUI ESTÁ O MAIOR RISCO DO BLOCO 3. Estes fluxos NÃO têm sessão: usam o
-- token do link, enviado pelo navegador no header x-inove-access-token.
-- Antes de aplicar, rode a consulta de dependências da view no GUIA.md.

create or replace function public._rls_onboarding_client_id()
returns bigint
language sql
stable
security definer
set search_path = public, extensions
as $$
  select t.client_id
  from public.client_onboarding_tokens t
  where t.token = public._rls_access_token()
    and coalesce(t.used, false) = false
    and t.expires_at > now()
  limit 1;
$$;

create or replace function public._rls_portal_indicator_id()
returns bigint
language sql
stable
security definer
set search_path = public, extensions
as $$
  select t.indicator_id
  from public.indicator_tokens t
  where t.token = public._rls_access_token()
    and coalesce(t.is_active, false) = true
    and (t.expires_at is null or t.expires_at > now())
  limit 1;
$$;

revoke all on function public._rls_onboarding_client_id() from public, anon, authenticated;
revoke all on function public._rls_portal_indicator_id() from public, anon, authenticated;
grant execute on function public._rls_onboarding_client_id() to anon, authenticated;
grant execute on function public._rls_portal_indicator_id() to anon, authenticated;

-- Tokens: acesso pelo próprio token OU pelo painel autenticado.
do $$
begin
  perform public._p0_drop_permissive(array[
    'client_onboarding_tokens', 'indicator_tokens'
  ]);

  execute format('drop policy if exists %I on public.client_onboarding_tokens', 'P0 link onboarding');
  execute format($f$
    create policy %I on public.client_onboarding_tokens
      for all to anon, authenticated
      using (
        token = public._rls_access_token()
        or public._rls_can_access(environment)
      )
      with check (
        token = public._rls_access_token()
        or public._rls_can_access(environment)
      )
  $f$, 'P0 link onboarding');

  execute format('drop policy if exists %I on public.indicator_tokens', 'P0 link indicador');
  execute format($f$
    create policy %I on public.indicator_tokens
      for all to anon, authenticated
      using (
        token = public._rls_access_token()
        or public._rls_can_access(environment)
      )
      with check (
        token = public._rls_access_token()
        or public._rls_can_access(environment)
      )
  $f$, 'P0 link indicador');
end $$;

-- Onboarding: o link pode ler e atualizar SOMENTE o cliente do próprio token.
do $$
begin
  execute format('drop policy if exists %I on public.clients', 'P0 onboarding leitura');
  execute format($f$
    create policy %I on public.clients
      for select to anon, authenticated
      using (id = public._rls_onboarding_client_id())
  $f$, 'P0 onboarding leitura');

  execute format('drop policy if exists %I on public.clients', 'P0 onboarding escrita');
  execute format($f$
    create policy %I on public.clients
      for update to anon, authenticated
      using (id = public._rls_onboarding_client_id())
      with check (id = public._rls_onboarding_client_id())
  $f$, 'P0 onboarding escrita');
end $$;

-- Portal do indicador: somente registros do indicador vinculado ao token.
do $$
begin
  execute format('drop policy if exists %I on public.commission_payments', 'P0 portal indicador');
  execute format($f$
    create policy %I on public.commission_payments
      for select to anon, authenticated
      using (indicator_id = public._rls_portal_indicator_id())
  $f$, 'P0 portal indicador');

  execute format('drop policy if exists %I on public.contracts', 'P0 portal indicador');
  execute format($f$
    create policy %I on public.contracts
      for select to anon, authenticated
      using (indicator_id = public._rls_portal_indicator_id())
  $f$, 'P0 portal indicador');
end $$;

-- A view vw_portal_commission_details, se estiver com security_invoker=on,
-- aplica RLS nas tabelas de base. Antes de aplicar este lote, descubra quais
-- são e repita o padrão acima (ou ajuste a view) no GUIA.md.

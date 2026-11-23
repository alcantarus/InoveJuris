-- P0 / Bloco 3 — fundação da RLS por sessão
--
-- Nada aqui é executado pelo agente. Aplicar no SQL Editor do Supabase.
-- Este arquivo CRIA funções auxiliares; não remove nenhuma policy ainda.
--
-- Modelo: o navegador envia o JWT assinado de sessão (claims: session_id,
-- environment, is_superadmin, sub). As policies exigem que o session_id seja
-- uma sessão ativa no banco e que a coluna `environment` da linha coincida com
-- a claim `environment`. A chave anon sem token não tem session_id e portanto
-- não vê nada — sem depender de FORCE RLS nem de trocar o role do JWT.

create or replace function public._rls_claims()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(auth.jwt(), '{}'::jsonb);
$$;

create or replace function public._rls_session_id()
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select nullif(public._rls_claims()->>'session_id', '')::uuid;
$$;

create or replace function public._rls_environment()
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(nullif(public._rls_claims()->>'environment', ''), 'production');
$$;

create or replace function public._rls_user_id()
returns bigint
language sql
stable
security definer
set search_path = public, extensions
as $$
  select nullif(public._rls_claims()->>'sub', '')::bigint;
$$;

create or replace function public._rls_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce((public._rls_claims()->>'is_superadmin')::boolean, false);
$$;

-- Token de link público (onboarding/portal do indicador). Enviado como header
-- próprio pelo navegador; não é uma claim de sessão.
create or replace function public._rls_access_token()
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select nullif(
    coalesce(current_setting('request.headers', true), '{}')::jsonb->>'x-inove-access-token',
    ''
  );
$$;

-- Valida a claim contra user_sessions: logout, expiração e heartbeat são
-- respeitados pela função existente da Fase A. SEM token, retorna false.
create or replace function public._rls_session_valid()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select public._auth_session_payload(
           public._rls_session_id(),
           public._rls_environment()
         ) is not null;
$$;

-- Expressão única usada por todas as policies de domínio.
-- p_environment null = tabela sem coluna environment (ou global).
create or replace function public._rls_can_access(p_environment text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select public._rls_session_valid()
     and (p_environment is null or p_environment = public._rls_environment());
$$;

-- Remove policies permissivas por CONDIÇÃO, não por nome: o inventário F4b
-- mostrou vários nomes diferentes criados por SQLs legados.
create or replace function public._p0_drop_permissive(p_tables text[])
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(p_tables)
      and (
           qual is null or btrim(qual) = 'true'
        or with_check is null or btrim(with_check) = 'true'
      )
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

-- Aplica a policy padrão. Detecta sozinha se a tabela tem `environment`.
create or replace function public._p0_apply_isolation(p_tables text[])
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  t text;
  has_env boolean;
begin
  foreach t in array p_tables loop
    if not exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = t
    ) then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', 'P0 sessao', t);

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'environment'
    ) into has_env;

    if has_env then
      execute format($f$
        create policy %I on public.%I
          for all to anon, authenticated
          using (public._rls_can_access(environment))
          with check (public._rls_can_access(environment))
      $f$, 'P0 sessao', t);
    else
      execute format($f$
        create policy %I on public.%I
          for all to anon, authenticated
          using (public._rls_can_access(null))
          with check (public._rls_can_access(null))
      $f$, 'P0 sessao', t);
    end if;
  end loop;
end;
$$;

-- Policy somente leitura (users, por exemplo: escrita já passa por RPC).
create or replace function public._p0_apply_readonly(p_tables text[])
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  t text;
  has_env boolean;
begin
  foreach t in array p_tables loop
    if not exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = t
    ) then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', 'P0 somente leitura', t);

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'environment'
    ) into has_env;

    if has_env then
      execute format($f$
        create policy %I on public.%I
          for select to anon, authenticated
          using (public._rls_can_access(environment))
      $f$, 'P0 somente leitura', t);
    else
      execute format($f$
        create policy %I on public.%I
          for select to anon, authenticated
          using (public._rls_can_access(null))
      $f$, 'P0 somente leitura', t);
    end if;
  end loop;
end;
$$;

-- Helpers internos: somente o owner via SECURITY DEFINER; nunca chamados
-- diretamente pelo navegador.
revoke all on function public._rls_claims() from public, anon, authenticated;
revoke all on function public._rls_session_id() from public, anon, authenticated;
revoke all on function public._rls_environment() from public, anon, authenticated;
revoke all on function public._rls_user_id() from public, anon, authenticated;
revoke all on function public._rls_is_superadmin() from public, anon, authenticated;
revoke all on function public._rls_access_token() from public, anon, authenticated;
revoke all on function public._rls_session_valid() from public, anon, authenticated;
revoke all on function public._rls_can_access(text) from public, anon, authenticated;
revoke all on function public._p0_drop_permissive(text[]) from public, anon, authenticated;
revoke all on function public._p0_apply_isolation(text[]) from public, anon, authenticated;
revoke all on function public._p0_apply_readonly(text[]) from public, anon, authenticated;

-- As policies chamam _rls_can_access(); o autor da policy precisa de EXECUTE.
grant execute on function public._rls_can_access(text) to anon, authenticated;
grant execute on function public._rls_access_token() to anon, authenticated;

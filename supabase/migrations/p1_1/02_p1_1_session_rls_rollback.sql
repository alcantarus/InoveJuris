-- P1.1 — rollback
-- 23/11/2026
--
-- Restaura EXATAMENTE as definições capturadas em produção no diagnóstico
-- (docs/DIAGNOSTICO-P1-1-RESUMO.sql, campo `definicoes_atuais`).
--
-- Não há índices criados pelo apply, portanto não há índice para remover.
-- Policies, grants, get_auth_organization() e a policy legada de users não
-- foram alterados e também não são aqui.

begin;

-- Volta a VOLATILE (ausência da palavra-chave STABLE, como em produção).
create or replace function public._auth_session_payload(
  p_session_id uuid,
  p_environment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.user_sessions%rowtype;
  v_user public.users%rowtype;
begin
  if p_session_id is null then
    return null;
  end if;

  select * into v_session
  from public.user_sessions
  where id = p_session_id;

  if not found or v_session.logout_at is not null then
    return null;
  end if;

  if p_environment is not null and v_session.environment <> p_environment then
    return null;
  end if;

  -- Heartbeat a cada 20s; 90s de tolerância cobrem pausas curtas no celular
  -- sem deixar uma sessão órfã por minutos após o fechamento da aba.
  if v_session.last_seen_at < now() - interval '90 seconds' then
    return null;
  end if;

  if v_session.login_at < now() - interval '12 hours' then
    return null;
  end if;

  select * into v_user
  from public.users
  where id = v_session.user_id;

  if not found then
    return null;
  end if;

  if v_user.expiration_date is not null and v_user.expiration_date < current_date then
    return null;
  end if;

  return public._auth_user_payload(v_user, v_session.id)
         || jsonb_build_object('environment', v_session.environment);
end;
$$;

-- Restaura a versão antiga, que montava o payload completo só para devolver
-- true/false.
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

commit;

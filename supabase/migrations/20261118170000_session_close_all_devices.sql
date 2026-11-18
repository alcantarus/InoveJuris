-- Encerramento de sessão ao fechar aba/janela, em qualquer dispositivo.
-- Quando uma aba do sistema é fechada, o cliente avisa o servidor e todas as
-- sessões ativas daquele usuário são encerradas. Se o aviso não chegar
-- (celular em segundo plano, queda de rede ou crash), o prazo de tolerância
-- do heartbeat cai de 10 minutos para 90 segundos.

-- Regras de validação de sessão com tolerância curta de 90 segundos.
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

-- Encerra todas as sessões ativas do usuário dono da sessão informada.
-- A sessão informada pode estar com last_seen_at antigo (aviso de fechamento
-- enviado tardiamente), mas precisa existir e não ter sido encerrada antes.
create or replace function public.app_logout_all_user_sessions(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id bigint;
begin
  select user_id into v_user_id
  from public.user_sessions
  where id = p_session_id and logout_at is null;

  if not found then
    return jsonb_build_object('success', false);
  end if;

  update public.user_sessions
  set logout_at = now(), last_seen_at = now()
  where user_id = v_user_id and logout_at is null;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public._auth_session_payload(uuid, text) from public;
revoke all on function public.app_logout_all_user_sessions(uuid) from public;

grant execute on function public._auth_session_payload(uuid, text) to anon, authenticated;
grant execute on function public.app_logout_all_user_sessions(uuid) to anon, authenticated;

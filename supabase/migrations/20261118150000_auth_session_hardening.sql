-- Endurecimento de autenticação e sessão do InoveJuris.
-- Objetivos:
--   1) comparar senhas somente no banco (SECURITY DEFINER), sem expor hash ao cliente;
--   2) sessão opaca validada no servidor, com logout no fechamento do navegador;
--   3) reduzir policies permissivas em tabelas sensíveis;
--   4) manter compatibilidade com o fluxo de dois passos da tela de login.

create table if not exists public.login_challenges (
  id uuid primary key default uuid_generate_v4(),
  user_id bigint not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.login_challenges enable row level security;
revoke all on table public.login_challenges from anon, authenticated, public;

-- bcryptjs gera hashes $2b$; o pgcrypto do Supabase verifica $2a$.
-- O corpo do hash é o mesmo, apenas o prefixo da versão muda.
create or replace function public._auth_normalize_bcrypt(p_hash text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when p_hash is null then null
    when left(p_hash, 4) = '$2b$' then '$2a$' || substring(p_hash from 5)
    else p_hash
  end;
$$;

create or replace function public._auth_user_payload(
  p_user public.users,
  p_session_id uuid default null
)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', p_user.id,
    'name', p_user.name,
    'email', p_user.email,
    'role_name', null,
    'is_superadmin', coalesce(p_user.is_superadmin, false),
    'canAccessDashboard', coalesce(p_user."canAccessDashboard", true),
    'canAccessClients', coalesce(p_user."canAccessClients", false),
    'canAccessProcesses', coalesce(p_user."canAccessProcesses", false),
    'canAccessContracts', coalesce(p_user."canAccessContracts", false),
    'canAccessCashFlow', coalesce(p_user."canAccessCashFlow", false),
    'canAccessReceivables', coalesce(p_user."canAccessReceivables", false),
    'canAccessProducts', coalesce(p_user."canAccessProducts", false),
    'canAccessIndicators', coalesce(p_user."canAccessIndicators", false),
    'canAccessReports', coalesce(p_user."canAccessReports", false),
    'canAccessUsers', coalesce(p_user."canAccessUsers", false),
    'canAccessSettings', coalesce(p_user."canAccessSettings", false),
    'canAccessAudit', coalesce(p_user."canAccessAudit", false),
    'canAccessLawyers', coalesce(p_user."canAccessLawyers", false),
    'canAccessDocuments', coalesce(p_user."canAccessDocuments", false),
    'canAccessDocTemplates', coalesce(p_user."canAccessDocTemplates", false),
    'canAccessDocGeneration', coalesce(p_user."canAccessDocGeneration", false),
    'canAccessLeads', coalesce(p_user."canAccessLeads", false),
    'canAccessProdEnv', coalesce(p_user."canAccessProdEnv", true),
    'canAccessTestEnv', coalesce(p_user."canAccessTestEnv", false),
    'expiration_date', p_user.expiration_date,
    'selectedEnv', null,
    'sessionId', p_session_id
  );
$$;

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

  -- Heartbeat a cada 30s; tolera pausas curtas, mas derruba sessões
  -- restauradas depois de o navegador ter sido fechado.
  if v_session.last_seen_at < now() - interval '10 minutes' then
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

create or replace function public.app_authenticate(
  p_email text,
  p_password text,
  p_ip text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user public.users%rowtype;
  v_hash text;
  v_attempts integer := 0;
  v_challenge uuid;
  v_generic jsonb := jsonb_build_object(
    'success', false,
    'error', 'E-mail ou senha inválidos.',
    'code', 'invalid_credentials'
  );
begin
  delete from public.login_challenges where created_at < now() - interval '1 day';

  if v_email = '' or length(v_email) > 254 or p_password is null
     or length(p_password) < 1 or length(p_password) > 200 then
    return v_generic;
  end if;

  select count(*) into v_attempts
  from public.login_attempts
  where lower(coalesce(email, '')) = v_email
    and attempted_at > now() - interval '10 minutes';

  if v_attempts >= 5 then
    return jsonb_build_object(
      'success', false,
      'error', 'Muitas tentativas de acesso. Tente novamente em 10 minutos.',
      'code', 'rate_limited'
    );
  end if;

  select * into v_user
  from public.users
  where lower(email) = v_email;

  if not found then
    insert into public.login_attempts (email, ip_address, user_agent, reason, attempted_at)
    values (v_email, p_ip, left(coalesce(p_user_agent, ''), 500), 'Credenciais inválidas', now());
    return v_generic;
  end if;

  if v_user.expiration_date is not null and v_user.expiration_date < current_date then
    insert into public.login_attempts (email, ip_address, user_agent, reason, attempted_at)
    values (v_email, p_ip, left(coalesce(p_user_agent, ''), 500), 'Conta expirada', now());
    return jsonb_build_object(
      'success', false,
      'error', 'E-mail ou senha inválidos.',
      'code', 'account_expired'
    );
  end if;

  v_hash := public._auth_normalize_bcrypt(v_user.password);

  if v_hash is null or extensions.crypt(p_password, v_hash) is distinct from v_hash then
    insert into public.login_attempts (email, ip_address, user_agent, reason, attempted_at)
    values (v_email, p_ip, left(coalesce(p_user_agent, ''), 500), 'Senha inválida', now());
    return v_generic;
  end if;

  insert into public.login_challenges (user_id, expires_at, ip_address, user_agent)
  values (v_user.id, now() + interval '5 minutes', p_ip, left(coalesce(p_user_agent, ''), 500))
  returning id into v_challenge;

  return jsonb_build_object(
    'success', true,
    'challenge', v_challenge,
    'user', public._auth_user_payload(v_user)
  );
end;
$$;

create or replace function public.app_complete_login(
  p_challenge uuid,
  p_environment text,
  p_ip text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_challenge public.login_challenges%rowtype;
  v_user public.users%rowtype;
  v_session_id uuid;
  v_ua text := left(coalesce(p_user_agent, 'Desconhecido'), 500);
  v_trusted public.trusted_devices%rowtype;
  v_previous integer := 0;
begin
  if p_environment not in ('production', 'test') then
    return jsonb_build_object('success', false, 'error', 'Ambiente inválido.');
  end if;

  select * into v_challenge
  from public.login_challenges
  where id = p_challenge
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'A validação expirou. Faça login novamente.',
      'code', 'invalid_challenge'
    );
  end if;

  select * into v_user
  from public.users
  where id = v_challenge.user_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Usuário não encontrado.');
  end if;

  if p_environment = 'production' and coalesce(v_user."canAccessProdEnv", true) = false then
    return jsonb_build_object('success', false, 'error', 'Você não tem permissão para acessar o Ambiente de Produção.');
  end if;

  if p_environment = 'test' and coalesce(v_user."canAccessTestEnv", false) = false then
    return jsonb_build_object('success', false, 'error', 'Você não tem permissão para acessar o Ambiente de Teste.');
  end if;

  update public.login_challenges set used_at = now() where id = v_challenge.id;

  update public.user_sessions
  set logout_at = now(), last_seen_at = now()
  where user_id = v_user.id and logout_at is null;

  select * into v_trusted
  from public.trusted_devices
  where user_id = v_user.id and user_agent = v_ua
  limit 1;

  if found then
    update public.trusted_devices set last_used_at = now() where id = v_trusted.id;
  else
    select count(*) into v_previous
    from public.user_sessions
    where user_id = v_user.id and user_agent = v_ua;

    if v_previous = 0 then
      insert into public.notifications (user_id, title, message, type, environment, created_at)
      values (
        v_user.id,
        'Alerta de Segurança',
        'Acesso de um novo dispositivo (' || v_ua || ').',
        'warning',
        p_environment,
        now()
      );
    end if;
  end if;

  insert into public.user_sessions (
    user_id, environment, ip_address, user_agent, login_at, last_seen_at
  )
  values (v_user.id, p_environment, p_ip, v_ua, now(), now())
  returning id into v_session_id;

  insert into public.audit_logs (
    table_name, record_id, action, performed_by, environment, new_data, performed_at
  )
  values (
    'user_sessions', v_session_id::text, 'login', v_user.id, p_environment,
    jsonb_build_object('ip_address', p_ip, 'user_agent', v_ua, 'login_at', now()),
    now()
  );

  return jsonb_build_object(
    'success', true,
    'sessionId', v_session_id,
    'user', public._auth_user_payload(v_user, v_session_id) || jsonb_build_object('environment', p_environment)
  );
end;
$$;

create or replace function public.app_validate_session(
  p_session_id uuid,
  p_environment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payload jsonb;
begin
  v_payload := public._auth_session_payload(p_session_id, p_environment);

  if v_payload is null then
    return jsonb_build_object('valid', false);
  end if;

  update public.user_sessions
  set last_seen_at = now()
  where id = p_session_id and logout_at is null;

  return jsonb_build_object('valid', true, 'user', v_payload);
end;
$$;

create or replace function public.app_heartbeat(
  p_session_id uuid,
  p_environment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payload jsonb;
begin
  v_payload := public._auth_session_payload(p_session_id, p_environment);

  if v_payload is null then
    return jsonb_build_object('valid', false);
  end if;

  update public.user_sessions set last_seen_at = now() where id = p_session_id;
  return jsonb_build_object('valid', true);
end;
$$;

create or replace function public.app_logout(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.user_sessions
  set logout_at = now(), last_seen_at = now()
  where id = p_session_id and logout_at is null;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.app_switch_environment(
  p_session_id uuid,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payload jsonb;
  v_user public.users%rowtype;
begin
  v_payload := public._auth_session_payload(p_session_id, null);

  if v_payload is null or p_environment not in ('production', 'test') then
    return jsonb_build_object('success', false, 'error', 'Sessão inválida.');
  end if;

  select * into v_user from public.users where id = (v_payload->>'id')::bigint;

  if p_environment = 'production' and coalesce(v_user."canAccessProdEnv", true) = false then
    return jsonb_build_object('success', false, 'error', 'Você não tem permissão para acessar o Ambiente de Produção.');
  end if;

  if p_environment = 'test' and coalesce(v_user."canAccessTestEnv", false) = false then
    return jsonb_build_object('success', false, 'error', 'Você não tem permissão para acessar o Ambiente de Teste.');
  end if;

  update public.user_sessions set environment = p_environment, last_seen_at = now() where id = p_session_id;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public._auth_require_admin(p_session_id uuid)
returns public.users
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payload jsonb;
  v_user public.users%rowtype;
begin
  v_payload := public._auth_session_payload(p_session_id, null);

  if v_payload is null
     or (coalesce((v_payload->>'canAccessUsers')::boolean, false) = false
         and coalesce((v_payload->>'is_superadmin')::boolean, false) = false) then
    raise exception 'Acesso negado';
  end if;

  select * into v_user from public.users where id = (v_payload->>'id')::bigint;
  return v_user;
end;
$$;

create or replace function public.app_admin_save_user(
  p_session_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.users%rowtype;
  v_user public.users%rowtype;
  v_id bigint := nullif(p_payload->>'id', '')::bigint;
  v_password text := nullif(p_payload->>'password', '');
  v_role_id bigint := nullif(p_payload->>'role_id', '')::bigint;
  v_expiration date := case
    when p_payload ? 'expiration_date' and nullif(p_payload->>'expiration_date', '') is not null
      then (p_payload->>'expiration_date')::date
    else null
  end;
begin
  v_admin := public._auth_require_admin(p_session_id);

  if v_id is null then
    if v_password is null then
      return jsonb_build_object('success', false, 'error', 'A senha é obrigatória para novos usuários.');
    end if;

    insert into public.users (
      name, email, password,
      "canAccessDashboard", "canAccessClients", "canAccessProcesses",
      "canAccessContracts", "canAccessCashFlow", "canAccessReceivables",
      "canAccessProducts", "canAccessIndicators", "canAccessReports",
      "canAccessUsers", "canAccessSettings", "canAccessAudit", "canAccessLawyers",
      "canAccessDocuments", "canAccessDocTemplates", "canAccessDocGeneration",
      "canAccessLeads", "canAccessProdEnv", "canAccessTestEnv",
      is_superadmin, expiration_date, created_by, updated_by
    )
    values (
      p_payload->>'name', lower(btrim(p_payload->>'email')),
      extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
      coalesce((p_payload->>'canAccessDashboard')::boolean, false),
      coalesce((p_payload->>'canAccessClients')::boolean, false),
      coalesce((p_payload->>'canAccessProcesses')::boolean, false),
      coalesce((p_payload->>'canAccessContracts')::boolean, false),
      coalesce((p_payload->>'canAccessCashFlow')::boolean, false),
      coalesce((p_payload->>'canAccessReceivables')::boolean, false),
      coalesce((p_payload->>'canAccessProducts')::boolean, false),
      coalesce((p_payload->>'canAccessIndicators')::boolean, false),
      coalesce((p_payload->>'canAccessReports')::boolean, false),
      coalesce((p_payload->>'canAccessUsers')::boolean, false),
      coalesce((p_payload->>'canAccessSettings')::boolean, false),
      coalesce((p_payload->>'canAccessAudit')::boolean, false),
      coalesce((p_payload->>'canAccessLawyers')::boolean, false),
      coalesce((p_payload->>'canAccessDocuments')::boolean, false),
      coalesce((p_payload->>'canAccessDocTemplates')::boolean, false),
      coalesce((p_payload->>'canAccessDocGeneration')::boolean, false),
      coalesce((p_payload->>'canAccessLeads')::boolean, false),
      coalesce((p_payload->>'canAccessProdEnv')::boolean, false),
      coalesce((p_payload->>'canAccessTestEnv')::boolean, false),
      coalesce((p_payload->>'is_superadmin')::boolean, false),
      v_expiration, v_admin.id, v_admin.id
    )
    returning * into v_user;
  else
    update public.users set
      name = p_payload->>'name',
      email = lower(btrim(p_payload->>'email')),
      password = case when v_password is null then password
                      else extensions.crypt(v_password, extensions.gen_salt('bf', 10)) end,
      "canAccessDashboard" = coalesce((p_payload->>'canAccessDashboard')::boolean, false),
      "canAccessClients" = coalesce((p_payload->>'canAccessClients')::boolean, false),
      "canAccessProcesses" = coalesce((p_payload->>'canAccessProcesses')::boolean, false),
      "canAccessContracts" = coalesce((p_payload->>'canAccessContracts')::boolean, false),
      "canAccessCashFlow" = coalesce((p_payload->>'canAccessCashFlow')::boolean, false),
      "canAccessReceivables" = coalesce((p_payload->>'canAccessReceivables')::boolean, false),
      "canAccessProducts" = coalesce((p_payload->>'canAccessProducts')::boolean, false),
      "canAccessIndicators" = coalesce((p_payload->>'canAccessIndicators')::boolean, false),
      "canAccessReports" = coalesce((p_payload->>'canAccessReports')::boolean, false),
      "canAccessUsers" = coalesce((p_payload->>'canAccessUsers')::boolean, false),
      "canAccessSettings" = coalesce((p_payload->>'canAccessSettings')::boolean, false),
      "canAccessAudit" = coalesce((p_payload->>'canAccessAudit')::boolean, false),
      "canAccessLawyers" = coalesce((p_payload->>'canAccessLawyers')::boolean, false),
      "canAccessDocuments" = coalesce((p_payload->>'canAccessDocuments')::boolean, false),
      "canAccessDocTemplates" = coalesce((p_payload->>'canAccessDocTemplates')::boolean, false),
      "canAccessDocGeneration" = coalesce((p_payload->>'canAccessDocGeneration')::boolean, false),
      "canAccessLeads" = coalesce((p_payload->>'canAccessLeads')::boolean, false),
      "canAccessProdEnv" = coalesce((p_payload->>'canAccessProdEnv')::boolean, false),
      "canAccessTestEnv" = coalesce((p_payload->>'canAccessTestEnv')::boolean, false),
      is_superadmin = coalesce((p_payload->>'is_superadmin')::boolean, false),
      expiration_date = v_expiration,
      updated_by = v_admin.id
    where id = v_id
    returning * into v_user;
  end if;

  if v_role_id is not null then
    delete from public.user_roles where user_id = v_user.id;
    insert into public.user_roles (user_id, role_id, environment, created_by, updated_by)
    values (v_user.id, v_role_id, coalesce(p_payload->>'environment', 'production'), v_admin.id, v_admin.id);
  end if;

  return jsonb_build_object('success', true, 'user', public._auth_user_payload(v_user));
end;
$$;

create or replace function public.app_admin_delete_user(
  p_session_id uuid,
  p_user_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.users%rowtype;
  v_target public.users%rowtype;
begin
  v_admin := public._auth_require_admin(p_session_id);

  select * into v_target from public.users where id = p_user_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Usuário não encontrado.');
  end if;

  if v_target.id = v_admin.id then
    return jsonb_build_object('success', false, 'error', 'Você não pode excluir a si mesmo.');
  end if;

  if v_target.name in ('Administrador', 'Anderson Alcântara Silva') then
    return jsonb_build_object('success', false, 'error', 'Este usuário não pode ser excluído.');
  end if;

  if coalesce(v_target.is_superadmin, false) and not coalesce(v_admin.is_superadmin, false) then
    return jsonb_build_object('success', false, 'error', 'Você não tem permissão para excluir um super administrador.');
  end if;

  delete from public.users where id = p_user_id;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.app_admin_impersonate(
  p_session_id uuid,
  p_target_user_id bigint,
  p_ip text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.users%rowtype;
  v_target public.users%rowtype;
  v_challenge uuid;
begin
  v_admin := public._auth_require_admin(p_session_id);

  select * into v_target from public.users where id = p_target_user_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Usuário não encontrado.');
  end if;

  insert into public.audit_logs (
    table_name, record_id, action, performed_by, environment, new_data, performed_at
  )
  values (
    'users', p_target_user_id::text, 'impersonate', v_admin.id, null,
    jsonb_build_object('target_user_id', p_target_user_id, 'ip_address', p_ip, 'user_agent', p_user_agent),
    now()
  );

  insert into public.login_challenges (user_id, expires_at, ip_address, user_agent)
  values (v_target.id, now() + interval '5 minutes', p_ip, left(coalesce(p_user_agent, ''), 500))
  returning id into v_challenge;

  return jsonb_build_object(
    'success', true,
    'challenge', v_challenge,
    'user', public._auth_user_payload(v_target)
  );
end;
$$;

create or replace function public.app_admin_terminate_session(
  p_session_id uuid,
  p_target_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.users%rowtype;
begin
  v_admin := public._auth_require_admin(p_session_id);

  update public.user_sessions
  set logout_at = now(), last_seen_at = now()
  where id = p_target_session_id and logout_at is null;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.app_admin_trust_device(
  p_session_id uuid,
  p_target_user_id bigint,
  p_user_agent text,
  p_ip text,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.users%rowtype;
begin
  v_admin := public._auth_require_admin(p_session_id);

  insert into public.trusted_devices (
    user_id, device_name, user_agent, ip_address, location, environment, trusted_at, last_used_at
  )
  values (
    p_target_user_id, left(coalesce(p_user_agent, 'Dispositivo'), 500),
    left(coalesce(p_user_agent, 'Desconhecido'), 500), p_ip, 'Desconhecido',
    p_environment, now(), now()
  );

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.app_get_security_data(
  p_session_id uuid,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.users%rowtype;
  v_payload jsonb;
begin
  v_payload := public._auth_session_payload(p_session_id, p_environment);

  if v_payload is null
     or (coalesce((v_payload->>'canAccessAudit')::boolean, false) = false
         and coalesce((v_payload->>'is_superadmin')::boolean, false) = false) then
    raise exception 'Acesso negado';
  end if;

  select * into v_admin from public.users where id = (v_payload->>'id')::bigint;

  return jsonb_build_object(
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'user_id', s.user_id,
        'user', jsonb_build_object('name', u.name, 'email', u.email),
        'environment', s.environment,
        'ip_address', s.ip_address,
        'user_agent', s.user_agent,
        'login_at', s.login_at,
        'last_seen_at', s.last_seen_at,
        'logout_at', s.logout_at
      ) order by s.login_at desc)
      from (
        select * from public.user_sessions
        where environment = p_environment
        order by login_at desc limit 500
      ) s
      left join public.users u on u.id = s.user_id
    ), '[]'::jsonb),
    'failed', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'email', a.email,
        'ip_address', a.ip_address,
        'user_agent', a.user_agent,
        'reason', a.reason,
        'attempted_at', a.attempted_at
      ) order by a.attempted_at desc)
      from (
        select * from public.login_attempts
        where environment = p_environment
        order by attempted_at desc limit 500
      ) a
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'user_id', d.user_id,
        'device_name', d.device_name,
        'user_agent', d.user_agent,
        'ip_address', d.ip_address,
        'location', d.location,
        'trusted_at', d.trusted_at,
        'last_used_at', d.last_used_at
      ) order by d.last_used_at desc)
      from (
        select * from public.trusted_devices
        where environment = p_environment
        order by last_used_at desc limit 500
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.app_get_my_trusted_devices(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payload jsonb;
begin
  v_payload := public._auth_session_payload(p_session_id, null);

  if v_payload is null then
    raise exception 'Sessão inválida';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id,
      'device_name', d.device_name,
      'user_agent', d.user_agent,
      'ip_address', d.ip_address,
      'location', d.location,
      'trusted_at', d.trusted_at,
      'last_used_at', d.last_used_at
    ) order by d.last_used_at desc)
    from public.trusted_devices d
    where d.user_id = (v_payload->>'id')::bigint
  ), '[]'::jsonb);
end;
$$;

create or replace function public.app_remove_my_trusted_device(
  p_session_id uuid,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payload jsonb;
begin
  v_payload := public._auth_session_payload(p_session_id, null);

  if v_payload is null then
    raise exception 'Sessão inválida';
  end if;

  delete from public.trusted_devices
  where id = p_device_id and user_id = (v_payload->>'id')::bigint;

  return jsonb_build_object('success', true);
end;
$$;

-- Permissões de execução somente para as roles usadas pela aplicação.
revoke all on function public._auth_normalize_bcrypt(text) from public;
revoke all on function public._auth_user_payload(public.users, uuid) from public;
revoke all on function public._auth_session_payload(uuid, text) from public;
revoke all on function public._auth_require_admin(uuid) from public;

revoke all on function public.app_authenticate(text, text, text, text) from public;
revoke all on function public.app_complete_login(uuid, text, text, text) from public;
revoke all on function public.app_validate_session(uuid, text) from public;
revoke all on function public.app_heartbeat(uuid, text) from public;
revoke all on function public.app_logout(uuid) from public;
revoke all on function public.app_switch_environment(uuid, text) from public;
revoke all on function public.app_admin_save_user(uuid, jsonb) from public;
revoke all on function public.app_admin_delete_user(uuid, bigint) from public;
revoke all on function public.app_admin_impersonate(uuid, bigint, text, text) from public;
revoke all on function public.app_admin_terminate_session(uuid, uuid) from public;
revoke all on function public.app_admin_trust_device(uuid, bigint, text, text, text) from public;
revoke all on function public.app_get_security_data(uuid, text) from public;
revoke all on function public.app_get_my_trusted_devices(uuid) from public;
revoke all on function public.app_remove_my_trusted_device(uuid, uuid) from public;

grant execute on function public.app_authenticate(text, text, text, text) to anon, authenticated;
grant execute on function public.app_complete_login(uuid, text, text, text) to anon, authenticated;
grant execute on function public.app_validate_session(uuid, text) to anon, authenticated;
grant execute on function public.app_heartbeat(uuid, text) to anon, authenticated;
grant execute on function public.app_logout(uuid) to anon, authenticated;
grant execute on function public.app_switch_environment(uuid, text) to anon, authenticated;
grant execute on function public.app_admin_save_user(uuid, jsonb) to anon, authenticated;
grant execute on function public.app_admin_delete_user(uuid, bigint) to anon, authenticated;
grant execute on function public.app_admin_impersonate(uuid, bigint, text, text) to anon, authenticated;
grant execute on function public.app_admin_terminate_session(uuid, uuid) to anon, authenticated;
grant execute on function public.app_admin_trust_device(uuid, bigint, text, text, text) to anon, authenticated;
grant execute on function public.app_get_security_data(uuid, text) to anon, authenticated;
grant execute on function public.app_get_my_trusted_devices(uuid) to anon, authenticated;
grant execute on function public.app_remove_my_trusted_device(uuid, uuid) to anon, authenticated;

-- Usuários: leitura permitida, escrita somente via RPC com sessão válida.
drop policy if exists "Allow all access" on public.users;
drop policy if exists "Permissive policy for users" on public.users;
drop policy if exists "Superadmin protected delete" on public.users;
drop policy if exists "Superadmin protected update" on public.users;
drop policy if exists "Administradores podem atualizar usuários" on public.users;
drop policy if exists "Users can insert users" on public.users;
drop policy if exists "Superadmins podem criar usuários" on public.users;

revoke insert, update, delete on public.users from anon, authenticated, public;
revoke select on public.users from anon, authenticated, public;

do $$
declare
  v_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'users'
    and column_name <> 'password';

  execute format('grant select (%s) on public.users to anon, authenticated, public', v_columns);
end $$;

-- Tabelas sensíveis: acesso direto bloqueado; somente funções SECURITY DEFINER.
drop policy if exists "Allow all access to audit_logs" on public.audit_logs;
-- audit_logs continua legível/gravável para compatibilidade com auditoria da aplicação.
-- (As policies restantes não permitem alterar credenciais.)

drop policy if exists "Allow all access to login_attempts" on public.login_attempts;
drop policy if exists "Permissive policy for login_attempts" on public.login_attempts;
drop policy if exists "Public access for login_attempts" on public.login_attempts;
drop policy if exists "Authenticated read access to login_attempts" on public.login_attempts;
drop policy if exists "Admin access for login_attempts" on public.login_attempts;
drop policy if exists "Filter by organization" on public.login_attempts;
drop policy if exists "Isolamento por Tenant em login_attempts" on public.login_attempts;
drop policy if exists "Isolamento_Definitivo_Tenant" on public.login_attempts;

drop policy if exists "Allow all access to trusted_devices" on public.trusted_devices;
drop policy if exists "Permissive policy for trusted_devices" on public.trusted_devices;
drop policy if exists "Public access for trusted_devices" on public.trusted_devices;
drop policy if exists "Authenticated read access to trusted_devices" on public.trusted_devices;
drop policy if exists "Admin access for trusted_devices" on public.trusted_devices;
drop policy if exists "User access for trusted_devices" on public.trusted_devices;
drop policy if exists "Filter by organization" on public.trusted_devices;
drop policy if exists "Isolamento por Tenant em trusted_devices" on public.trusted_devices;
drop policy if exists "Isolamento_Definitivo_Tenant" on public.trusted_devices;

drop policy if exists "Allow all access to user_sessions" on public.user_sessions;
drop policy if exists "Permissive policy for user_sessions" on public.user_sessions;
drop policy if exists "Authenticated read access to user_sessions" on public.user_sessions;
drop policy if exists "Enable read access for all users" on public.user_sessions;
drop policy if exists "Enable insert for all users" on public.user_sessions;
drop policy if exists "Enable update for all users" on public.user_sessions;
drop policy if exists "Enable delete for all users" on public.user_sessions;
drop policy if exists "Enable insert for server-side auth" on public.user_sessions;
drop policy if exists "Enable read/update for server-side auth" on public.user_sessions;
drop policy if exists "Filter by organization" on public.user_sessions;
drop policy if exists "Isolamento por Tenant em user_sessions" on public.user_sessions;
drop policy if exists "Isolamento_Definitivo_Tenant" on public.user_sessions;

revoke all on table public.login_attempts from anon, authenticated, public;
revoke all on table public.trusted_devices from anon, authenticated, public;
revoke all on table public.user_sessions from anon, authenticated, public;

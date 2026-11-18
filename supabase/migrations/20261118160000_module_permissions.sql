-- Permissões granulares para Prazos, Calendário e Publicações.
-- Até esta migration os três módulos herdavam canAccessProcesses.
-- O backfill preserva exatamente o acesso que cada usuário já possui.

alter table public.users
  add column if not exists "canAccessPrazos" boolean not null default false,
  add column if not exists "canAccessCalendario" boolean not null default false,
  add column if not exists "canAccessPublicacoes" boolean not null default false;

update public.users
set
  "canAccessPrazos" = coalesce("canAccessProcesses", false),
  "canAccessCalendario" = coalesce("canAccessProcesses", false),
  "canAccessPublicacoes" = coalesce("canAccessProcesses", false);

-- O endurecimento de autenticação concedeu SELECT coluna a coluna (sem password).
-- As colunas novas precisam entrar nessa mesma lista para o formulário de
-- Usuários continuar carregando os registros.
grant select ("canAccessPrazos", "canAccessCalendario", "canAccessPublicacoes")
  on public.users to anon, authenticated, public;

insert into public.permissions (slug, description) values
  ('access_prazos', 'Acesso a Prazos'),
  ('access_calendario', 'Acesso ao Calendário'),
  ('access_publicacoes', 'Acesso a Publicações')
on conflict (slug) do nothing;

-- Perfis que já tinham Processos no perfil padrão recebem os três módulos.
-- Administrador também é coberto pela regra is_superadmin/isAdmin do formulário.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('Administrador', 'Advogado', 'Estagiário')
  and p.slug in ('access_prazos', 'access_calendario', 'access_publicacoes')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

-- Payload de autenticação: novos flags + fail-closed para superadmin.
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
    'canAccessDashboard', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessDashboard", true),
    'canAccessClients', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessClients", false),
    'canAccessProcesses', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessProcesses", false),
    'canAccessPrazos', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessPrazos", false),
    'canAccessCalendario', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessCalendario", false),
    'canAccessPublicacoes', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessPublicacoes", false),
    'canAccessContracts', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessContracts", false),
    'canAccessCashFlow', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessCashFlow", false),
    'canAccessReceivables', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessReceivables", false),
    'canAccessProducts', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessProducts", false),
    'canAccessIndicators', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessIndicators", false),
    'canAccessReports', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessReports", false),
    'canAccessUsers', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessUsers", false),
    'canAccessSettings', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessSettings", false),
    'canAccessAudit', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessAudit", false),
    'canAccessLawyers', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessLawyers", false),
    'canAccessDocuments', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessDocuments", false),
    'canAccessDocTemplates', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessDocTemplates", false),
    'canAccessDocGeneration', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessDocGeneration", false),
    'canAccessLeads', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessLeads", false),
    'canAccessProdEnv', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessProdEnv", true),
    'canAccessTestEnv', coalesce(p_user.is_superadmin, false) or coalesce(p_user."canAccessTestEnv", false),
    'expiration_date', p_user.expiration_date,
    'selectedEnv', null,
    'sessionId', p_session_id
  );
$$;

-- Gravação de usuários: novos campos, regras anti-elevação e auditoria de permissões.
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
  v_existing public.users%rowtype;
  v_user public.users%rowtype;
  v_id bigint := nullif(p_payload->>'id', '')::bigint;
  v_password text := nullif(p_payload->>'password', '');
  v_role_id bigint := nullif(p_payload->>'role_id', '')::bigint;
  v_expiration date := case
    when p_payload ? 'expiration_date' and nullif(p_payload->>'expiration_date', '') is not null
      then (p_payload->>'expiration_date')::date
    else null
  end;
  v_is_superadmin boolean;
  v_flag text;
  v_requested boolean;
  v_current boolean;
  v_old_payload jsonb := '{}'::jsonb;
  v_new_payload jsonb;
  v_changed_fields jsonb;
  v_role_id_atual bigint;
begin
  v_admin := public._auth_require_admin(p_session_id);
  v_is_superadmin := coalesce(v_admin.is_superadmin, false);

  if v_id is not null then
    select * into v_existing from public.users where id = v_id;
    if not found then
      return jsonb_build_object('success', false, 'error', 'Usuário não encontrado.');
    end if;

    if coalesce(v_existing.is_superadmin, false) and not v_is_superadmin then
      return jsonb_build_object('success', false, 'error', 'Somente superadministradores podem alterar um superadministrador.');
    end if;
  end if;

  -- Um administrador comum não pode criar/promover superadministradores
  -- nem concedir as permissões administrativas/sensíveis.
  if not v_is_superadmin then
    if coalesce((p_payload->>'is_superadmin')::boolean, false) then
      return jsonb_build_object('success', false, 'error', 'Somente superadministradores podem conceder privilégios de superadministrador.');
    end if;

    foreach v_flag in array array[
      'canAccessUsers', 'canAccessSettings', 'canAccessAudit',
      'canAccessProdEnv', 'canAccessTestEnv'
    ] loop
      v_requested := coalesce((p_payload->>v_flag)::boolean, false);
      v_current := case
        when v_id is null then false
        else coalesce((to_jsonb(v_existing) ->> v_flag)::boolean, false)
      end;

      if v_requested and not v_current then
        return jsonb_build_object(
          'success', false,
          'error', 'Somente superadministradores podem conceder acesso a ' || v_flag || '.'
        );
      end if;
    end loop;

    if v_role_id is not null and exists (
      select 1 from public.roles where id = v_role_id and name = 'Administrador'
    ) then
      return jsonb_build_object('success', false, 'error', 'Somente superadministradores podem atribuir o perfil Administrador.');
    end if;
  end if;

  if v_password is not null and length(v_password) < 10 then
    return jsonb_build_object('success', false, 'error', 'A senha deve ter no mínimo 10 caracteres.');
  end if;

  if v_id is null then
    if v_password is null then
      return jsonb_build_object('success', false, 'error', 'A senha é obrigatória para novos usuários.');
    end if;

    insert into public.users (
      name, email, password,
      "canAccessDashboard", "canAccessClients", "canAccessProcesses",
      "canAccessPrazos", "canAccessCalendario", "canAccessPublicacoes",
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
      coalesce((p_payload->>'canAccessPrazos')::boolean, false),
      coalesce((p_payload->>'canAccessCalendario')::boolean, false),
      coalesce((p_payload->>'canAccessPublicacoes')::boolean, false),
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
      "canAccessPrazos" = coalesce((p_payload->>'canAccessPrazos')::boolean, false),
      "canAccessCalendario" = coalesce((p_payload->>'canAccessCalendario')::boolean, false),
      "canAccessPublicacoes" = coalesce((p_payload->>'canAccessPublicacoes')::boolean, false),
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

  -- Auditoria da diferença efetiva de permissões.
  if v_id is not null then
    select ur.role_id into v_role_id_atual
    from public.user_roles ur
    where ur.user_id = v_existing.id
    order by ur.id
    limit 1;
    v_old_payload := public._auth_user_payload(v_existing)
                    || jsonb_build_object('role_id', v_role_id_atual);
  end if;
  v_new_payload := public._auth_user_payload(v_user)
                  || jsonb_build_object('role_id', coalesce(v_role_id, v_role_id_atual));

  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  into v_changed_fields
  from jsonb_each(v_new_payload) e
  where v_old_payload -> e.key is distinct from e.value;

  insert into public.audit_logs (
    table_name, record_id, action, performed_by, environment,
    old_data, new_data, changed_fields, performed_at
  )
  values (
    'users', v_user.id::text, case when v_id is null then 'INSERT' else 'UPDATE' end,
    v_admin.id, coalesce(p_payload->>'environment', 'production'),
    v_old_payload, v_new_payload, v_changed_fields, now()
  );

  return jsonb_build_object('success', true, 'user', public._auth_user_payload(v_user));
end;
$$;

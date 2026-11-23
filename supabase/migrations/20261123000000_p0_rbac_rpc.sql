-- P0 / Bloco 2 — RBAC somente via RPC SECURITY DEFINER
--
-- Nada aqui e executado pelo agente. Aplicar no SQL Editor do Supabase
-- (owner postgres), nunca com a service_role da aplicacao.
--
-- A autorização continua no modelo atual da aplicação: sessão validada por
-- p_session_id. A vinculação ao JWT do Postgres fica para a etapa seguinte,
-- quando as rotas do servidor passarem a repassar o Bearer token.

-- ---------------------------------------------------------------------------
-- Helper: somente superadministrador
-- ---------------------------------------------------------------------------
create or replace function public._auth_require_superadmin(p_session_id uuid)
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
     or coalesce((v_payload->>'is_superadmin')::boolean, false) = false then
    raise exception 'Acesso negado';
  end if;

  select * into v_user from public.users where id = (v_payload->>'id')::bigint;
  return v_user;
end;
$$;

revoke all on function public._auth_require_superadmin(uuid) from public;

-- ---------------------------------------------------------------------------
-- Leitura de perfis/permissões
-- ---------------------------------------------------------------------------
create or replace function public.app_get_rbac(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payload jsonb;
  v_admin public.users%rowtype;
  v_env text;
  v_permissions jsonb;
  v_roles jsonb;
begin
  v_admin := public._auth_require_superadmin(p_session_id);
  v_payload := public._auth_session_payload(p_session_id, null);
  v_env := coalesce(v_payload->>'environment', 'production');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'description', p.description
  ) order by p.description), '[]'::jsonb)
  into v_permissions
  from public.permissions p;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'description', r.description,
      'permissions', coalesce((
        select jsonb_agg(p.slug order by p.slug)
        from public.role_permissions rp
        join public.permissions p on p.id = rp.permission_id
        where rp.role_id = r.id
      ), '[]'::jsonb)
    ) order by r.name
  ), '[]'::jsonb)
  into v_roles
  from public.roles r
  where r.environment = v_env;

  return jsonb_build_object(
    'success', true,
    'environment', v_env,
    'permissions', v_permissions,
    'roles', v_roles
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Criar/editar perfil
-- ---------------------------------------------------------------------------
create or replace function public.app_admin_save_role(
  p_session_id uuid,
  p_id bigint,
  p_name text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.users%rowtype;
  v_payload jsonb;
  v_env text;
  v_name text := btrim(coalesce(p_name, ''));
  v_existing public.roles%rowtype;
  v_conflict bigint;
  v_role_id bigint;
begin
  v_admin := public._auth_require_superadmin(p_session_id);
  v_payload := public._auth_session_payload(p_session_id, null);
  v_env := coalesce(v_payload->>'environment', 'production');

  if v_name = '' then
    return jsonb_build_object('success', false, 'error', 'Nome do perfil é obrigatório.');
  end if;

  if lower(v_name) = 'administrador' then
    return jsonb_build_object('success', false, 'error', 'O perfil Administrador não pode ser criado ou alterado por aqui.');
  end if;

  select id into v_conflict
    from public.roles
   where environment = v_env
     and name = v_name
     and (p_id is null or id <> p_id)
   limit 1;

  if v_conflict is not null then
    return jsonb_build_object('success', false, 'error', 'Já existe perfil com este nome.');
  end if;

  if p_id is not null then
    select * into v_existing from public.roles where id = p_id;
    if not found then
      return jsonb_build_object('success', false, 'error', 'Perfil não encontrado.');
    end if;
    if lower(v_existing.name) = 'administrador' then
      return jsonb_build_object('success', false, 'error', 'O perfil Administrador não pode ser alterado.');
    end if;

    update public.roles
       set name = v_name, description = p_description
     where id = p_id;
    v_role_id := p_id;
  else
    insert into public.roles (name, description, environment)
    values (v_name, p_description, v_env)
    returning id into v_role_id;
  end if;

  insert into public.audit_logs (table_name, record_id, action, new_data, performed_by, environment)
  values (
    'roles', v_role_id::text, case when p_id is null then 'create' else 'update' end,
    jsonb_build_object('name', v_name, 'description', p_description),
    v_admin.id, v_env
  );

  return jsonb_build_object('success', true, 'id', v_role_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Excluir perfil
-- ---------------------------------------------------------------------------
create or replace function public.app_admin_delete_role(
  p_session_id uuid,
  p_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.users%rowtype;
  v_payload jsonb;
  v_env text;
  v_role public.roles%rowtype;
  v_users integer;
begin
  v_admin := public._auth_require_superadmin(p_session_id);
  v_payload := public._auth_session_payload(p_session_id, null);
  v_env := coalesce(v_payload->>'environment', 'production');

  select * into v_role from public.roles where id = p_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Perfil não encontrado.');
  end if;

  if lower(v_role.name) = 'administrador' then
    return jsonb_build_object('success', false, 'error', 'O perfil Administrador não pode ser excluído.');
  end if;

  select count(*) into v_users from public.user_roles where role_id = p_id;
  if v_users > 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'Este perfil está atribuído a usuários. Remova a atribuição antes de excluí-lo.'
    );
  end if;

  insert into public.audit_logs (table_name, record_id, action, old_data, performed_by, environment)
  values ('roles', p_id::text, 'delete', jsonb_build_object('name', v_role.name), v_admin.id, v_env);

  delete from public.role_permissions where role_id = p_id;
  delete from public.roles where id = p_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Vincular/desvincular permissão do perfil
-- ---------------------------------------------------------------------------
create or replace function public.app_admin_set_role_permission(
  p_session_id uuid,
  p_role_id bigint,
  p_permission_slug text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin public.users%rowtype;
  v_payload jsonb;
  v_env text;
  v_role public.roles%rowtype;
  v_permission public.permissions%rowtype;
begin
  v_admin := public._auth_require_superadmin(p_session_id);
  v_payload := public._auth_session_payload(p_session_id, null);
  v_env := coalesce(v_payload->>'environment', 'production');

  select * into v_role from public.roles where id = p_role_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Perfil não encontrado.');
  end if;

  if lower(v_role.name) = 'administrador' then
    return jsonb_build_object('success', false, 'error', 'As permissões do perfil Administrador não podem ser alteradas.');
  end if;

  select * into v_permission from public.permissions where slug = p_permission_slug;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Permissão não encontrada.');
  end if;

  if coalesce(p_enabled, false) then
    insert into public.role_permissions (role_id, permission_id)
    values (p_role_id, v_permission.id)
    on conflict (role_id, permission_id) do nothing;
  else
    delete from public.role_permissions
    where role_id = p_role_id and permission_id = v_permission.id;
  end if;

  insert into public.audit_logs (table_name, record_id, action, new_data, performed_by, environment)
  values (
    'role_permissions', p_role_id::text,
    case when coalesce(p_enabled, false) then 'grant' else 'revoke' end,
    jsonb_build_object('role', v_role.name, 'permission', p_permission_slug),
    v_admin.id, v_env
  );

  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões de execução: somente a aplicação (service_role no servidor).
-- Nenhuma chamada direta do navegador pode alterar RBAC.
-- ---------------------------------------------------------------------------
revoke all on function public.app_get_rbac(uuid) from public, anon, authenticated;
revoke all on function public.app_admin_save_role(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.app_admin_delete_role(uuid, bigint) from public, anon, authenticated;
revoke all on function public.app_admin_set_role_permission(uuid, bigint, text, boolean) from public, anon, authenticated;

grant execute on function public.app_get_rbac(uuid) to service_role;
grant execute on function public.app_admin_save_role(uuid, bigint, text, text) to service_role;
grant execute on function public.app_admin_delete_role(uuid, bigint) to service_role;
grant execute on function public.app_admin_set_role_permission(uuid, bigint, text, boolean) to service_role;

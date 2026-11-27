-- FORWARD - tenant na RPC save_client_guardians
-- 26/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Diagnostico 20:23Z: SECURITY INVOKER, hash 2b1b80269f809d61f895ce9fdfe381fd,
-- sem organization_id e sem leitura de claim.
-- client_relationships NAO tem organization_id: o tenant e validado em clients.
-- Reutiliza o helper criado no FORWARD-RPCS-PRAZOS-TENANT-20261126.
-- Salva o corpo original na mesma tabela de backup antes de substituir.

begin;

do $$
declare
  v_count integer;
begin
  if to_regprocedure('public._tenant_claim_organization_id()') is null then
    raise exception 'Abortado: helper _tenant_claim_organization_id ausente. Aplique antes o FORWARD-RPCS-PRAZOS-TENANT-20261126.';
  end if;

  select count(*) into v_count
    from public._tenant_rpc_backup_20261126
   where nome = 'save_client_guardians';

  if v_count = 0 then
    insert into public._tenant_rpc_backup_20261126 (nome, assinatura, hash_def, def)
    select p.proname,
           pg_get_function_identity_arguments(p.oid),
           md5(pg_get_functiondef(p.oid)),
           pg_get_functiondef(p.oid)
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = 'save_client_guardians';
  elsif v_count <> 1 then
    raise exception 'Abortado: backup duplicado de save_client_guardians (%)', v_count;
  end if;

  if not exists (
    select 1 from public._tenant_rpc_backup_20261126
     where nome = 'save_client_guardians'
       and hash_def = '2b1b80269f809d61f895ce9fdfe381fd'
  ) then
    raise exception 'Abortado: definicao viva divergiu do diagnostico 20:23Z';
  end if;
end $$;

create or replace function public.save_client_guardians(
  p_client_id BIGINT,
  p_environment TEXT,
  p_guardians JSONB DEFAULT '[]'::jsonb,
  p_edited_by BIGINT DEFAULT NULL
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org          uuid := public._tenant_claim_organization_id();
  v_client_env   text;
  v_client_org   uuid;
  v_item         jsonb;
  v_related      bigint;
  v_primary_count integer;
begin
  if v_org is null then
    raise exception 'Organização da sessão não encontrada.' using errcode = '42501';
  end if;

  if p_client_id is null or nullif(btrim(coalesce(p_environment, '')), '') is null then
    raise exception 'Cliente e ambiente são obrigatórios.' using errcode = '22023';
  end if;

  select environment, organization_id into v_client_env, v_client_org
    from public.clients
   where id = p_client_id;

  if not found
     or v_client_env is distinct from p_environment
     or v_client_org is distinct from v_org then
    raise exception 'Cliente não encontrado neste ambiente/organização.' using errcode = 'P0002';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_guardians, '[]'::jsonb)) loop
    v_related := nullif(btrim(coalesce(v_item->>'related_client_id', '')), '')::bigint;

    if v_related is null or v_related = p_client_id then
      raise exception 'Responsável inválido para o menor.' using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.clients
       where id = v_related
         and environment = p_environment
         and organization_id = v_org
    ) then
      raise exception 'Responsável não encontrado neste ambiente/organização.' using errcode = 'P0002';
    end if;
  end loop;

  select count(*) into v_primary_count
    from jsonb_array_elements(coalesce(p_guardians, '[]'::jsonb))
   where coalesce((value->>'is_primary')::boolean, false);

  if v_primary_count > 1 then
    raise exception 'Apenas um responsável pode ser principal.' using errcode = '22023';
  end if;

  delete from public.client_relationships r
   where r.client_id = p_client_id
     and r.environment = p_environment
     and exists (
       select 1 from public.clients c
        where c.id = r.client_id
          and c.organization_id = v_org
     );

  insert into public.client_relationships (
    environment, client_id, related_client_id, relationship_type,
    relationship_label, guardianship_type, is_primary, valid_from, valid_until,
    created_by, updated_by
  )
  select
    p_environment,
    p_client_id,
    nullif(btrim(coalesce(item->>'related_client_id', '')), '')::bigint,
    coalesce(nullif(btrim(coalesce(item->>'relationship_type', '')), ''), 'outro'),
    coalesce(nullif(btrim(coalesce(item->>'relationship_label', '')), ''), 'responsável legal'),
    nullif(btrim(coalesce(item->>'guardianship_type', '')), ''),
    coalesce((item->>'is_primary')::boolean, false),
    nullif(btrim(coalesce(item->>'valid_from', '')), '')::date,
    nullif(btrim(coalesce(item->>'valid_until', '')), '')::date,
    p_edited_by,
    p_edited_by
  from jsonb_array_elements(coalesce(p_guardians, '[]'::jsonb)) as item;

  update public.clients
     set updated_by = coalesce(p_edited_by, updated_by)
   where id = p_client_id
     and organization_id = v_org;
end $$;

commit;

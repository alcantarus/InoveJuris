-- VERIFY - RPC save_client_guardians apos o FORWARD
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).

begin;

select jsonb_pretty(jsonb_build_object(
  'ambiente_declarado', 'production + test',
  'verificado_em', now(),
  'helper_existe', to_regprocedure('public._tenant_claim_organization_id()') is not null,
  'backup_original_preservado', (
    select count(*) = 1
      from public._tenant_rpc_backup_20261126
     where nome = 'save_client_guardians'
       and hash_def = '2b1b80269f809d61f895ce9fdfe381fd'
  ),
  'funcao', (
    select jsonb_build_object(
      'nome', p.proname,
      'argumentos', pg_get_function_identity_arguments(p.oid),
      'hash_def', md5(pg_get_functiondef(p.oid)),
      'seguranca', case when p.prosecdef then 'definer' else 'invoker' end,
      'usa_helper', pg_get_functiondef(p.oid) ilike '%_tenant_claim_organization_id%',
      'usa_organization_id', pg_get_functiondef(p.oid) ilike '%organization_id%',
      'bloqueia_sem_claim', pg_get_functiondef(p.oid) ilike '%v_org is null%',
      'filtra_related_por_org', pg_get_functiondef(p.oid) ilike '%responsável não encontrado neste ambiente/organização%',
      'permissoes', (
        select coalesce(jsonb_agg(r.rolname order by r.rolname), '[]'::jsonb)
          from aclexplode(p.proacl) a
          join pg_roles r on r.oid = a.grantee
         where a.privilege_type = 'EXECUTE'
      )
    )
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = 'save_client_guardians'
  ),
  'pronto', (
       to_regprocedure('public._tenant_claim_organization_id()') is not null
       and exists (
         select 1 from public._tenant_rpc_backup_20261126
          where nome = 'save_client_guardians'
            and hash_def = '2b1b80269f809d61f895ce9fdfe381fd'
       )
       and exists (
         select 1 from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname = 'save_client_guardians'
            and not p.prosecdef
            and pg_get_functiondef(p.oid) ilike '%_tenant_claim_organization_id%'
            and pg_get_functiondef(p.oid) ilike '%organization_id%'
            and pg_get_functiondef(p.oid) ilike '%v_org is null%'
       )
  )
)) as resumo;

rollback;

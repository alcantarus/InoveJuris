-- VERIFY - RPC app_register_commission_payment apos o FORWARD
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
     where nome = 'app_register_commission_payment'
       and hash_def = '76f9b818d62ac7f0dde005ada25d48c3'
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
      'filtra_contrato_por_org', pg_get_functiondef(p.oid) ilike '%c.organization_id = v_org%',
      'filtra_pagamentos_por_org', pg_get_functiondef(p.oid) ilike '%cp.organization_id = v_org%',
      'permissoes', (
        select coalesce(jsonb_agg(r.rolname order by r.rolname), '[]'::jsonb)
          from aclexplode(p.proacl) a
          join pg_roles r on r.oid = a.grantee
         where a.privilege_type = 'EXECUTE'
      )
    )
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = 'app_register_commission_payment'
  ),
  'pronto', (
       to_regprocedure('public._tenant_claim_organization_id()') is not null
       and exists (
         select 1 from public._tenant_rpc_backup_20261126
          where nome = 'app_register_commission_payment'
            and hash_def = '76f9b818d62ac7f0dde005ada25d48c3'
       )
       and exists (
         select 1 from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname = 'app_register_commission_payment'
            and p.prosecdef
            and pg_get_functiondef(p.oid) ilike '%_tenant_claim_organization_id%'
            and pg_get_functiondef(p.oid) ilike '%v_org is null%'
            and pg_get_functiondef(p.oid) ilike '%c.organization_id = v_org%'
            and pg_get_functiondef(p.oid) ilike '%cp.organization_id = v_org%'
       )
  )
)) as resumo;

rollback;

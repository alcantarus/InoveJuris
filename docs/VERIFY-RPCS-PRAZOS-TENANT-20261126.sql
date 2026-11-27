-- VERIFY - RPCs de prazos apos o FORWARD
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem corpo de funcao: apenas hash, flags, assinatura e grants.

begin;

select jsonb_pretty(jsonb_build_object(
  'ambiente_declarado', 'production + test',
  'verificado_em', now(),
  'helper_existe', to_regprocedure('public._tenant_claim_organization_id()') is not null,
  'backup_linhas', (select count(*) from public._tenant_rpc_backup_20261126),
  'hashes_originais_preservados', (
    select count(*) = 4
      from public._tenant_rpc_backup_20261126 b
     where (b.nome = 'create_process_deadline'  and b.hash_def = '0d44f7e48cf9526d203d322016d2e3ba')
        or (b.nome = 'update_process_deadline'  and b.hash_def = '5e977c74135ab14c593bfc4812793cd5')
        or (b.nome = 'confirm_process_deadline' and b.hash_def = '2d1c7654391d857c90c1edc930ca231a')
        or (b.nome = 'delete_process_deadline'  and b.hash_def = '5525af895b460b5517f55ee3db03b293')
  ),
  'funcoes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'nome', p.proname,
      'argumentos', pg_get_function_identity_arguments(p.oid),
      'hash_def', md5(pg_get_functiondef(p.oid)),
      'seguranca', case when p.prosecdef then 'definer' else 'invoker' end,
      'usa_helper', pg_get_functiondef(p.oid) ilike '%_tenant_claim_organization_id%',
      'usa_organization_id', pg_get_functiondef(p.oid) ilike '%organization_id%',
      'bloqueia_sem_claim', pg_get_functiondef(p.oid) ilike '%v_org is null%',
      'permissoes', (
        select coalesce(jsonb_agg(r.rolname order by r.rolname), '[]'::jsonb)
          from aclexplode(p.proacl) a
          join pg_roles r on r.oid = a.grantee
         where a.privilege_type = 'EXECUTE'
      )
    ) order by p.proname), '[]'::jsonb)
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in (
         'create_process_deadline',
         'update_process_deadline',
         'confirm_process_deadline',
         'delete_process_deadline'
       )
  ),
  'pronto', (
       to_regprocedure('public._tenant_claim_organization_id()') is not null
       and (select count(*) = 4 from public._tenant_rpc_backup_20261126)
       and (
         select count(*) = 4
           from public._tenant_rpc_backup_20261126 b
          where (b.nome = 'create_process_deadline'  and b.hash_def = '0d44f7e48cf9526d203d322016d2e3ba')
             or (b.nome = 'update_process_deadline'  and b.hash_def = '5e977c74135ab14c593bfc4812793cd5')
             or (b.nome = 'confirm_process_deadline' and b.hash_def = '2d1c7654391d857c90c1edc930ca231a')
             or (b.nome = 'delete_process_deadline'  and b.hash_def = '5525af895b460b5517f55ee3db03b293')
       )
       and (
         select count(*) = 4
           from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname in (
              'create_process_deadline', 'update_process_deadline',
              'confirm_process_deadline', 'delete_process_deadline'
            )
            and not p.prosecdef
            and pg_get_functiondef(p.oid) ilike '%_tenant_claim_organization_id%'
            and pg_get_functiondef(p.oid) ilike '%organization_id%'
            and pg_get_functiondef(p.oid) ilike '%v_org is null%'
       )
  )
)) as resumo;

rollback;

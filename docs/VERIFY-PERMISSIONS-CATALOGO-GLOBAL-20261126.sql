-- ============================================================================
-- VERIFY — `permissions` como catálogo global (somente leitura)
-- 26/11/2026
--
-- Rode no SQL Editor de TEST antes/a depois da correção de código.
-- Confirma que os 23 vínculos de role_permissions em `test` apontam para os
-- 22 slugs existentes, sem inserir nem alterar nenhuma linha.
-- Sem slugs/linhas completas: só contagens e situacao. Termina em ROLLBACK.
-- ============================================================================

begin;

-- 1. Onde estão as linhas hoje (esperado: permissions 22/production, 0/test;
--    role_permissions 60/production, 23/test).
select 'permissions' as tabela,
       coalesce(environment::text, 'sem environment') as ambiente,
       coalesce(organization_id::text, 'sem org') as organizacao,
       count(*) as linhas
  from public.permissions
 group by 1, 2, 3

union all

select 'role_permissions',
       coalesce(environment::text, 'sem environment'),
       coalesce(organization_id::text, 'sem org'),
       count(*)
  from public.role_permissions
 group by 1, 2, 3

order by 1, 2, 3;

-- 2. Vínculos de `test` com o slug resolvido no catálogo (esperado: 23/23).
select coalesce(rp.environment::text, 'sem environment') as ambiente,
       count(*) as vinculos,
       count(p.id) as com_slug_no_catalogo,
       count(*) - count(p.id) as sem_slug,
       case when count(*) = count(p.id) then 'OK' else 'CONFERIR' end as situacao
  from public.role_permissions rp
  left join public.permissions p on p.id = rp.permission_id
 where coalesce(rp.environment::text, '') = 'test'
 group by 1;

-- 3. Perfis de `test` x permissões resolvidas (esperado: vinculos = resolvidos).
select r.name as perfil,
       count(rp.id) as vinculos,
       count(p.id) as slugs_resolvidos,
       case when count(rp.id) = count(p.id) then 'OK' else 'CONFERIR' end as situacao
  from public.roles r
  left join public.role_permissions rp on rp.role_id = r.id
  left join public.permissions p on p.id = rp.permission_id
 where coalesce(r.environment::text, '') = 'test'
 group by r.name
 order by r.name;

-- 4. Resumo: numbers do plano + integridade referencial.
select (select count(*) from public.permissions) as slugs_no_catalogo,
       (select count(*) from public.role_permissions
         where environment::text = 'test') as vinculos_test,
       (select count(*) from public.permissions
         where environment::text = 'test') as permissoes_duplicadas_no_test,
       (select count(*)
          from public.role_permissions rp
          left join public.permissions p on p.id = rp.permission_id
         where rp.environment::text = 'test'
           and p.id is null) as vinculos_sem_slug,
       case
         when (select count(*) from public.permissions) = 22
          and (select count(*) from public.role_permissions
                where environment::text = 'test') = 23
          and (select count(*)
                 from public.role_permissions rp
                 left join public.permissions p on p.id = rp.permission_id
                where rp.environment::text = 'test'
                  and p.id is null) = 0
         then 'PASS' else 'CONFERIR'
       end as situacao;

rollback;

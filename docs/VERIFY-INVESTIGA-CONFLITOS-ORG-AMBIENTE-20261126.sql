-- VERIFY - investigacao dos 24 conflitos antes de qualquer UPDATE
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.

begin;

with pag as (
  select
    p.id::text as payment_id,
    p.environment as payment_environment,
    p.organization_id as payment_organization_id,
    p.installment_id,
    i.environment as installment_environment,
    i.organization_id as installment_organization_id,
    i.contract_id,
    c.environment as contract_environment,
    c.organization_id as contract_organization_id
  from public.payments p
  join public.installments i on i.id = p.installment_id
  join public.contracts c on c.id = i.contract_id
  where p.environment is distinct from i.environment
     or p.environment is distinct from c.environment
     or p.organization_id is distinct from i.organization_id
     or p.organization_id is distinct from c.organization_id
),
perm as (
  select
    rp.role_id,
    rp.permission_id,
    rp.environment as permissao_environment,
    rp.organization_id as permissao_organization_id,
    r.name as role_name,
    r.environment as role_environment,
    r.organization_id as role_organization_id
  from public.role_permissions rp
  left join public.roles r on r.id = rp.role_id
  where rp.environment = 'production'
    and rp.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
),
uso_roles as (
  select
    ur.role_id,
    ur.environment as user_role_environment,
    ur.organization_id as user_role_organization_id,
    count(*) as vinculos
  from public.user_roles ur
  where ur.role_id in (104, 105)
  group by 1, 2, 3
),
perm_equivalentes as (
  select count(*) as total
    from public.role_permissions rp
   where rp.environment = 'production'
     and rp.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
     and rp.permission_id in (select permission_id from perm)
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',

  'pagamentos_inconsistentes', jsonb_build_object(
    'total', (select count(*) from pag),
    'amostra', (
      select coalesce(
               jsonb_agg(
                 jsonb_build_object(
                   'payment_id', payment_id,
                   'payment_environment', payment_environment,
                   'payment_organization_id', payment_organization_id,
                   'installment_id', installment_id,
                   'installment_environment', installment_environment,
                   'installment_organization_id', installment_organization_id,
                   'contract_id', contract_id,
                   'contract_environment', contract_environment,
                   'contract_organization_id', contract_organization_id
                 )
                 order by payment_id
               ),
               '[]'::jsonb
             )
        from (select * from pag order by payment_id limit 50) x
    )
  ),

  'permissoes_conflitantes', jsonb_build_object(
    'total', (select count(*) from perm),
    'roles', (
      select coalesce(
               jsonb_agg(
                 jsonb_build_object(
                   'role_id', role_id,
                   'role_name', role_name,
                   'role_environment', role_environment,
                   'role_organization_id', role_organization_id
                 )
                 order by role_id
               ),
               '[]'::jsonb
             )
        from (
          select distinct role_id, role_name, role_environment, role_organization_id
            from perm
        ) x
    ),
    'permissoes_equivalentes_em_production_alcantara',
      (select total from perm_equivalentes)
  ),

  'uso_das_roles_104_e_105', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'role_id', role_id,
                 'user_role_environment', user_role_environment,
                 'user_role_organization_id', user_role_organization_id,
                 'vinculos', vinculos
               )
               order by role_id, user_role_environment, user_role_organization_id
             ),
             '[]'::jsonb
           )
      from uso_roles
  ),

  'interpretacao', jsonb_build_object(
    'pagamento', 'Se payment_environment difere de installment/contract e a org e a da Demonstracao, o campo provavelmente errado e environment, nao organization_id.',
    'permissoes', 'Se as roles 104/105 aparecem apenas em test, as linhas de role_permissions com environment=production provavelmente foram classificadas errado. Se aparecerem vinculos em production, nao mexer sem decisao explicita.'
  )
)) as resumo;

rollback;

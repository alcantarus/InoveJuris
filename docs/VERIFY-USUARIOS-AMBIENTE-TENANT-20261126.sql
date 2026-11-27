-- VERIFY - usuarios x ambiente x tenant
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Nao mostra e-mails, nomes nem UUIDs: apenas rotulos e contagens.

begin;

select jsonb_pretty(jsonb_build_object(
  'ambiente_declarado', 'production + test',
  'verificado_em', now(),

  'usuario_2', (
    select jsonb_build_object(
      'id', u.id,
      'environment', coalesce(u.environment::text, 'sem environment'),
      'organizacao', case
        when u.organization_id is null then 'nula'
        when u.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid then 'production'
        when u.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid then 'test'
        else 'outra'
      end,
      'is_superadmin', coalesce(u.is_superadmin, false),
      'can_access_production', coalesce(u."canAccessProdEnv", true),
      'can_access_test', coalesce(u."canAccessTestEnv", false)
    )
      from public.users u
     where u.id = 2
  ),

  'contagem_usuarios', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'ambiente', ambiente,
      'organizacao', organizacao,
      'quantidade', quantidade
    ) order by ambiente, organizacao), '[]'::jsonb)
      from (
        select coalesce(u.environment::text, 'sem environment') as ambiente,
               case
                 when u.organization_id is null then 'nula'
                 when u.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid then 'production'
                 when u.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid then 'test'
                 else 'outra'
               end as organizacao,
               count(*) as quantidade
          from public.users u
         group by 1, 2
      ) s
  ),

  'sessoes_ativas', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'ambiente', ambiente,
      'organizacao', organizacao,
      'quantidade', quantidade
    ) order by ambiente, organizacao), '[]'::jsonb)
      from (
        select coalesce(s.environment::text, 'sem environment') as ambiente,
               case
                 when s.organization_id is null then 'nula'
                 when s.organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid then 'production'
                 when s.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid then 'test'
                 else 'outra'
               end as organizacao,
               count(*) as quantidade
          from public.user_sessions s
         where s.logout_at is null
         group by 1, 2
      ) s2
  ),

  'organizacoes', (
    select jsonb_build_object(
      'producao_presente', (count(*) filter (where id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid)) = 1,
      'teste_presente', (count(*) filter (where id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)) = 1,
      'teste_is_demo', coalesce(
        bool_or(case when id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid then is_demo = true end),
        false
      )
    )
      from public.organizations
  )
)) as resumo;

rollback;

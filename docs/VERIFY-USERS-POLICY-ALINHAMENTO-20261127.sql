-- VERIFY — alinhamento da policy legada de users apos o claim JWT
-- 27/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Somente leitura, termina em ROLLBACK. Nao imprime emails, nomes, session_id
-- nem qualquer dado de usuario — apenas contagens agregadas.
--
-- Checa se a policy "Isolamento por Organizacao em users" tem o que esperar:
--   producao -> organization_id = eaf29983-1998-40a4-bd07-03ea09b4adfa
--   teste    -> organization_id = cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd
-- superadmins continuam vendo tudo por causa do OR is_superadmin.

begin;

with med as (
  select
    u.environment,
    count(*) as total,
    count(*) filter (
      where u.organization_id = e.esperada
    ) as da_organizacao,
    count(*) filter (
      where u.is_superadmin is true
    ) as superadmins,
    count(*) filter (
      where u.organization_id = e.esperada or u.is_superadmin is true
    ) as visiveis_pela_policy
  from public.users u
  cross join lateral (
    select case u.environment
      when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
      when 'test'       then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
    end as esperada
  ) e
  where u.environment in ('production', 'test')
  group by u.environment, e.esperada
)
select jsonb_pretty(jsonb_build_object(
  'ambiente_declarado', 'production + test',
  'verificado_em', now(),
  'organizacao_producao', 'eaf29983-1998-40a4-bd07-03ea09b4adfa',
  'organizacao_teste', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd',
  'producao', (
    select jsonb_build_object(
      'total', total,
      'da_organizacao', da_organizacao,
      'superadmins', superadmins,
      'visiveis_pela_policy', visiveis_pela_policy
    ) from med where environment = 'production'
  ),
  'teste', (
    select jsonb_build_object(
      'total', total,
      'da_organizacao', da_organizacao,
      'superadmins', superadmins,
      'visiveis_pela_policy', visiveis_pela_policy
    ) from med where environment = 'test'
  ),
  'usuarios_cruzados', (
    select count(*)
      from public.users
     where (environment = 'production' and organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid)
        or (environment = 'test'       and organization_id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid)
  ),
  'org_fora_do_padrao', (
    select count(*)
      from public.users
     where environment in ('production', 'test')
       and organization_id is distinct from case environment
         when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
         when 'test'       then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
       end
  )
)) as resumo;

rollback;

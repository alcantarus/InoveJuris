-- VERIFY — get_auth_organization() lendo a claim JWT (somente leitura)
-- 27/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Nao usa tabela temporaria: o SQL Editor do Supabase nao resolve a relation
-- criada com `create temp table` de dentro do bloco/consulta seguinte.
-- Os GUCs sao alterados com `true` (escopo de transacao) e tudo termina em
-- ROLLBACK — nenhuma configuracao persiste.
--
-- Esperado: situacao = OK, quatro cenarios de claim corretos.

begin;

with
cfg_prod as materialized (
  select set_config(
    'request.jwt.claims',
    '{"organization_id":"eaf29983-1998-40a4-bd07-03ea09b4adfa","environment":"production","role":"anon","sub":"2"}',
    true
  ) as cfg
),
val_prod as materialized (
  select public.get_auth_organization() as org from cfg_prod
),
cfg_test as materialized (
  select set_config(
    'request.jwt.claims',
    '{"organization_id":"cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd","environment":"test","role":"anon","sub":"2"}',
    true
  ) as cfg
  from val_prod
),
val_test as materialized (
  select public.get_auth_organization() as org from cfg_test
),
-- "Sem claim" tambem deixa o GUC legado preenchido: se a funcao ainda lesse
-- custom.organization_id, este cenario retornaria a org de production.
cfg_sem as materialized (
  select
    set_config('custom.organization_id', 'eaf29983-1998-40a4-bd07-03ea09b4adfa', true) as guc_legado,
    set_config('request.jwt.claims', '{}', true) as cfg
  from val_test
),
val_sem as materialized (
  select public.get_auth_organization() as org from cfg_sem
),
cfg_invalida as materialized (
  select set_config(
    'request.jwt.claims',
    '{"organization_id":"nao-e-uuid","environment":"production","role":"anon","sub":"2"}',
    true
  ) as cfg
  from val_sem
),
val_invalida as materialized (
  select public.get_auth_organization() as org from cfg_invalida
),
meta as materialized (
  select
    to_regprocedure('public.get_auth_organization()') is not null as existe,
    pg_get_functiondef('public.get_auth_organization()'::regprocedure) as def,
    pg_get_function_result('public.get_auth_organization()'::regprocedure) as ret,
    exists (
      select 1 from public._tenant_jwt_org_backup_20261127 where id = 1
    ) as backup
)
select jsonb_pretty(jsonb_build_object(
  'ambiente_declarado', 'production + test',
  'verificado_em', now(),
  'funcao_existe', m.existe,
  'backup_capturado', m.backup,
  'usa_claim_jwt', m.def like '%_rls_claims%',
  'nao_usa_guc_legado', m.def not like '%custom.organization_id%',
  'retorna_uuid', m.ret = 'uuid',
  'security_definer', m.def like '%SECURITY DEFINER%',
  'cenario_producao', (select org = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid from val_prod),
  'cenario_teste', (select org = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid from val_test),
  'cenario_sem_claim', (select org is null from val_sem),
  'cenario_claim_invalida', (select org is null from val_invalida),
  'guc_legado_ignorado', (select org is null from val_sem),
  'situacao', case when
       m.existe
   and m.backup
   and m.def like '%_rls_claims%'
   and m.def not like '%custom.organization_id%'
   and m.ret = 'uuid'
   and m.def like '%SECURITY DEFINER%'
   and (select org = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid from val_prod)
   and (select org = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid from val_test)
   and (select org is null from val_sem)
   and (select org is null from val_invalida)
  then 'OK' else 'FALHA' end
)) as resumo
from meta m;

rollback;

-- VERIFY - conferencia apos a correcao dos 24 registros
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Esperado apos o FORWARD:
--   pagamentos_a_corrigir = 0
--   permissoes_a_corrigir = 0
--   pagamento_alvo_corrigido = true
--   permissoes_corrigidas = 23
--   production_com_org_demo = 0
--   backup.linhas = 24
--   correcao_concluida = true

begin;

-- Le a tabela de backup apenas se ela existir, sem quebrar o verify
-- quando o rollback ja tiver sido executado.
do $$
begin
  if to_regclass('public._correcao_ambiente_24_20261126') is not null then
    perform set_config(
      'verify.backup_linhas',
      (select count(*)::text from public._correcao_ambiente_24_20261126),
      true
    );
  else
    perform set_config('verify.backup_linhas', '0', true);
  end if;
end $$;

with dados as (
  select
    (select count(*)
       from public.payments p
       join public.installments i on i.id = p.installment_id
       join public.contracts c on c.id = i.contract_id
      where p.environment = 'production'
        and p.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
        and i.environment = 'test'
        and c.environment = 'test') as pagamentos_a_corrigir,

    (select count(*)
       from public.role_permissions rp
       join public.roles r on r.id = rp.role_id
      where rp.environment = 'production'
        and rp.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
        and r.environment = 'test'
        and r.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid) as permissoes_a_corrigir,

    (select exists (
       select 1
         from public.payments p
         join public.installments i on i.id = p.installment_id
         join public.contracts c on c.id = i.contract_id
        where p.id = 'c2c02242-89a9-4e63-8655-cde4878a4dcc'::uuid
          and p.environment = 'test'
          and p.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
          and i.environment = 'test'
          and c.environment = 'test'
     )) as pagamento_alvo_corrigido,

    (select count(*)
       from public.payments p
       join public.installments i on i.id = p.installment_id
       join public.contracts c on c.id = i.contract_id
      where p.environment = 'test'
        and p.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
        and i.environment = 'test'
        and c.environment = 'test') as pagamentos_test_demo_total,

    (select count(*)
       from public.role_permissions rp
       join public.roles r on r.id = rp.role_id
      where rp.environment = 'test'
        and rp.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
        and r.environment = 'test'
        and r.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid) as permissoes_corrigidas,

    (select count(*) from public.payments
      where environment = 'production'
        and organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid) as pag_production_demo,

    (select count(*) from public.role_permissions
      where environment = 'production'
        and organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid) as perm_production_demo,

    coalesce(nullif(current_setting('verify.backup_linhas', true), ''), '0')::bigint as backup_linhas,

    (select count(*) from public.payments t
      where t.organization_id is null and t.environment = 'production') as nulos_production_pagamentos,

    (select count(*) from public.role_permissions t
      where t.organization_id is null and t.environment = 'production') as nulos_production_permissoes
),
resumo as (
  select
    d.*,
    (d.pag_production_demo + d.perm_production_demo) as production_com_org_demo,
    (d.pagamentos_a_corrigir = 0
     and d.permissoes_a_corrigir = 0
     and d.pagamento_alvo_corrigido
     and d.permissoes_corrigidas = 23
     and d.pag_production_demo = 0
     and d.perm_production_demo = 0
     and d.backup_linhas = 24) as correcao_concluida
  from dados d
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'pagamentos_a_corrigir', pagamentos_a_corrigir,
  'permissoes_a_corrigir', permissoes_a_corrigir,
  'pagamento_alvo_corrigido', pagamento_alvo_corrigido,
  'pagamentos_test_demo_total', pagamentos_test_demo_total,
  'permissoes_corrigidas', permissoes_corrigidas,
  'production_com_org_demo', production_com_org_demo,
  'backup', jsonb_build_object(
    'tabela_existe', to_regclass('public._correcao_ambiente_24_20261126') is not null,
    'linhas', backup_linhas
  ),
  'backfill_dos_nulos_ainda_pendente', jsonb_build_object(
    'pagamentos_production', nulos_production_pagamentos,
    'permissoes_production', nulos_production_permissoes,
    'observacao', 'Este verify e so da correcao dos 24. O backfill completo vem no proximo passo.'
  ),
  'correcao_concluida', correcao_concluida
)) as resumo
from resumo;

rollback;

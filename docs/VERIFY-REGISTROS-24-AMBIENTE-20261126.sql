-- VERIFY - os 24 registros em conflito, em formato de tabela
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Nao ha UPDATE. Mostra exatamente o que seria ajustado:
--   1 pagamento  + 23 permissoes = 24 linhas
--   environment: production -> test
--   organization_id: mantido como Demonstracao

begin;

with linhas as (
  select
    'pagamento'::text as tipo,
    'payments'::text as tabela,
    p.id::text as registro_id,
    ('parcela ' || i.id::text || ' / contrato ' || c.id::text)::text as detalhe,
    p.environment::text as environment_atual,
    'test'::text as environment_sugerido,
    p.organization_id::text as organization_id_atual,
    p.organization_id::text as organization_id_sugerido,
    ('parcela=' || i.environment::text || ', contrato=' || c.environment::text)::text as evidencia,
    null::bigint as vinculos_user_roles,
    'environment diverge da parcela e do contrato; organization_id permanece Demonstracao'::text as motivo
  from public.payments p
  join public.installments i on i.id = p.installment_id
  join public.contracts c on c.id = i.contract_id
  where p.environment = 'production'
    and p.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
    and i.environment = 'test'
    and c.environment = 'test'

  union all

  select
    'permissao'::text as tipo,
    'role_permissions'::text as tabela,
    (rp.role_id::text || '/' || rp.permission_id::text)::text as registro_id,
    r.name::text as detalhe,
    rp.environment::text as environment_atual,
    'test'::text as environment_sugerido,
    rp.organization_id::text as organization_id_atual,
    rp.organization_id::text as organization_id_sugerido,
    ('role=' || r.environment::text || ', organizacao=' || r.organization_id::text)::text as evidencia,
    (select count(*) from public.user_roles ur where ur.role_id = r.id)::bigint as vinculos_user_roles,
    'permissao classificada como production, mas a role e test/Demonstracao'::text as motivo
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  where rp.environment = 'production'
    and rp.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
    and r.environment = 'test'
    and r.organization_id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
)
select
  tipo,
  tabela,
  registro_id,
  detalhe,
  environment_atual,
  environment_sugerido,
  organization_id_atual,
  organization_id_sugerido,
  evidencia,
  vinculos_user_roles,
  motivo,
  (select count(*) from linhas) as total_linhas
from linhas
order by tipo, registro_id;

rollback;

-- VERIFY - lista de tabelas publicas por presenca de organization_id
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
--
-- Usado para montar o allowlist do Proxy da camada 2: so injetar
-- organization_id nas tabelas que realmente possuem a coluna.
-- Nao mostra linhas de dados, apenas nomes de tabelas.

begin;

with tabelas as (
  select c.relname::text as tabela,
         coalesce(bool_or(a.attname = 'organization_id'), false) as tem_org,
         coalesce(bool_or(a.attname = 'environment'), false) as tem_env
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    left join pg_attribute a on a.attrelid = c.oid and not a.attisdropped
   where ns.nspname = 'public'
     and c.relkind in ('r', 'v')
   group by c.relname
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'com_organization_id_e_environment', (
    select coalesce(jsonb_agg(tabela order by tabela), '[]'::jsonb)
      from tabelas where tem_org and tem_env
  ),
  'sem_organization_id', (
    select coalesce(jsonb_agg(tabela order by tabela), '[]'::jsonb)
      from tabelas where not tem_org
  ),
  'total', (select count(*) from tabelas),
  'total_com_org', (select count(*) from tabelas where tem_org)
)) as resumo;

rollback;

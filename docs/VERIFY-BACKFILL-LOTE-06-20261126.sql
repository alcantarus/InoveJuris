-- VERIFY - previa agregada do LOTE 6 do backfill (financial_transactions)
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Nao mostra linhas, apenas contagens, limites de id e faixas sugeridas.
-- Contagens esperadas: production 1017, test 53, total 1070.
-- "faixas" usa ntile(8) sobre os ids em ordem para dividir o lote em
-- pedacos menores, sem depender de ctid.

begin;

with linhas as (
  select id, environment
    from public.financial_transactions
   where organization_id is null
     and environment in ('production', 'test')
),
faixas as (
  select ntile(8) over (order by id) as fatia, id
    from linhas
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'tabela', 'financial_transactions',
  'regra', jsonb_build_object(
    'production', 'eaf29983-1998-40a4-bd07-03ea09b4adfa',
    'test', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'
  ),
  'total_linhas', (select count(*) from linhas),
  'contagens', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'environment', c.environment,
             'nulos', c.n
           ) order by c.environment), '[]'::jsonb)
      from (select environment, count(*) as n from linhas group by environment) c
  ),
  'id_min', (select min(id) from linhas),
  'id_max', (select max(id) from linhas),
  'ids_duplicados', (select count(*) - count(distinct id) from linhas),
  'fora_do_mapa', (
    select count(*) from public.financial_transactions
     where organization_id is null
       and (environment is null or environment not in ('production', 'test'))
  ),
  'faixas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'fatia', f.fatia,
             'de', f.de,
             'ate', f.ate,
             'linhas', f.n
           ) order by f.fatia), '[]'::jsonb)
      from (
        select fatia, min(id) as de, max(id) as ate, count(*) as n
          from faixas
         group by fatia
      ) f
  )
)) as resumo;

rollback;

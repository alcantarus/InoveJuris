-- VERIFY - previa do LOTE 5B do backfill (notifications, 105 linhas)
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Mostra apenas identificadores: id, ambiente e organizacao destino.
-- Contagens esperadas: production 100, test 5, total 105.
-- "localizador" usa ctid apenas para apontar a linha na previa.
-- O UPDATE usara as chaves primarias reais via catalogo.

begin;

with linhas as (
  select t.ctid::text as localizador,
         t.id::text as id,
         t.environment::text as environment,
         case t.environment::text
           when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa'
           when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'
         end as organization_id_destino
    from public.notifications t
   where t.organization_id is null
     and t.environment in ('production', 'test')
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'tabela', 'notifications',
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
  'linhas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'localizador', l.localizador,
             'id', l.id,
             'environment', l.environment,
             'organization_id_destino', l.organization_id_destino
           ) order by l.environment, l.localizador), '[]'::jsonb)
      from linhas l
  )
)) as resumo;

rollback;

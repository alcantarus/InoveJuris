-- VERIFY - previa do LOTE 3 do backfill (69 linhas)
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Tabelas deste lote:
--   clients               (37 nulas)
--   commission_payments   (15 nulas)
--   financial_categories  (17 nulas)
--
-- "localizador" usa ctid apenas para mostrar a linha na previa.
-- O UPDATE do lote usara as chaves primarias reais via catalogo.
-- A contagem por tabela/ambiente no resumo sera usada como guarda no FORWARD.

begin;

with linhas as (
  select 'clients'::text as tabela, t.ctid::text as localizador,
         t.environment::text as environment,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end as organization_id_destino,
         (to_jsonb(t) - 'organization_id') as linha
    from public.clients t
   where t.organization_id is null and t.environment in ('production', 'test')

  union all

  select 'commission_payments', t.ctid::text, t.environment::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.commission_payments t
   where t.organization_id is null and t.environment in ('production', 'test')

  union all

  select 'financial_categories', t.ctid::text, t.environment::text,
         case t.environment::text when 'production' then 'eaf29983-1998-40a4-bd07-03ea09b4adfa' when 'test' then 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' end,
         (to_jsonb(t) - 'organization_id')
    from public.financial_categories t
   where t.organization_id is null and t.environment in ('production', 'test')
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'regra', jsonb_build_object(
    'production', 'eaf29983-1998-40a4-bd07-03ea09b4adfa',
    'test', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'
  ),
  'total_linhas', (select count(*) from linhas),
  'contagens', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'tabela', c.tabela,
             'environment', c.environment,
             'nulos', c.n
           ) order by c.tabela, c.environment), '[]'::jsonb)
      from (select tabela, environment, count(*) as n
              from linhas
             group by tabela, environment) c
  ),
  'linhas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'tabela', l.tabela,
             'localizador', l.localizador,
             'environment', l.environment,
             'organization_id_destino', l.organization_id_destino,
             'linha', l.linha
           ) order by l.tabela, l.environment, l.localizador), '[]'::jsonb)
      from linhas l
  )
)) as resumo;

rollback;

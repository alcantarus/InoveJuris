-- VERIFY - cardinalidade das organizacoes demo/producao
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Nao mostra nomes nem UUIDs: apenas contagens.

begin;

select jsonb_pretty(jsonb_build_object(
  'ambiente_declarado', 'production + test',
  'verificado_em', now(),
  'organizacoes', (
    select jsonb_build_object(
      'total', count(*),
      'demo', count(*) filter (where is_demo is true),
      'demo_mapeada', count(*) filter (where id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid),
      'demo_mapeada_e_unica', (
        count(*) filter (
          where id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid
            and is_demo is true
        ) = 1
      ),
      'producao_mapeada', count(*) filter (where id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid),
      'producao_nao_demo', count(*) filter (
        where id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid
          and is_demo is false
      )
    )
      from public.organizations
  )
)) as resumo;

rollback;

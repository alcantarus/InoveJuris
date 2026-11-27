-- VERIFY - Teste 1 / isolamento de dados por organizacao
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK. Uma unica celula: resumo.
--Sem tabelas temporarias nem bloco DO: funciona mesmo quando o SQL Editor
-- executa cada statement em conexao separada.
--
-- Objetivo: fechar o Teste 1 com `dados_isolados`. Em test, o Proxy de
-- lib/supabase.ts injeta organization_id = org demo nas consultas. Este
-- script mede, para TODA tabela publica que possui organization_id,
-- quantas linhas a org demo e a org de production veem.
--
-- Nao mostra nomes, e-mails nem UUIDs de linha: apenas rotulos e contagens.

begin;

with tabelas as (
  select c.oid,
         c.relname::text as tabela,
         exists (
           select 1 from pg_attribute a
            where a.attrelid = c.oid
              and a.attname = 'environment'
              and not a.attisdropped
         ) as has_env
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
                       and a.attname = 'organization_id'
                       and not a.attisdropped
   where ns.nspname = 'public'
     and c.relkind in ('r', 'v')
), documentos as (
  select t.tabela,
         t.has_env,
         query_to_xml(
           format(
             'select count(*) as total, '
             'count(*) filter (where organization_id::text = %L) as demo, '
             'count(*) filter (where organization_id::text = %L) as prod, '
             'count(*) filter (where organization_id is null) as nula, '
             'count(*) filter (where organization_id is not null '
             '  and organization_id::text not in (%L, %L)) as outra, '
             '%s as envtest, %s as envprod '
             'from public.%I',
             'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd',
             'eaf29983-1998-40a4-bd07-03ea09b4adfa',
             'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd',
             'eaf29983-1998-40a4-bd07-03ea09b4adfa',
             case when t.has_env
                  then 'count(*) filter (where environment = ''test'')'
                  else 'null::bigint' end,
             case when t.has_env
                  then 'count(*) filter (where environment = ''production'')'
                  else 'null::bigint' end,
             t.tabela
           ),
           false, false, ''
         ) as doc
    from tabelas t
), linhas as (
  select d.tabela,
         (xpath('/table/row/total/text()',   d.doc))[1]::text::bigint as total,
         (xpath('/table/row/demo/text()',    d.doc))[1]::text::bigint as demo,
         (xpath('/table/row/prod/text()',    d.doc))[1]::text::bigint as prod,
         (xpath('/table/row/nula/text()',    d.doc))[1]::text::bigint as nula,
         (xpath('/table/row/outra/text()',   d.doc))[1]::text::bigint as outra,
         (xpath('/table/row/envtest/text()', d.doc))[1]::text::bigint as envtest,
         (xpath('/table/row/envprod/text()', d.doc))[1]::text::bigint as envprod
    from documentos d
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test (banco unico)',
  'regra', 'Em test o Proxy injeta organization_id = org demo. org_demo abaixo e o que a tela DEVE mostrar em test; org_producao, o que production mostra.',
  'org_demo_rotulo', 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd',
  'org_producao_rotulo', 'eaf29983-1998-40a4-bd07-03ea09b4adfa',

  'organizacoes', jsonb_build_object(
    'demo_existe_e_is_demo', coalesce(
      (select is_demo from public.organizations
        where id = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid),
      false),
    'producao_existe_e_nao_demo', coalesce(
      (select not is_demo from public.organizations
        where id = 'eaf29983-1998-40a4-bd07-03ea09b4adfa'::uuid),
      false)
  ),

  'resumo', jsonb_build_object(
    'tabelas_com_organization_id', (select count(*) from linhas),
    'tabelas_com_linhas_demo', (select count(*) from linhas where demo > 0),
    'tabelas_somente_production', (select count(*) from linhas
                                    where demo = 0 and prod > 0),
    'tabelas_vazias', (select count(*) from linhas where total = 0),
    'total_org_nula', (select coalesce(sum(nula), 0) from linhas),
    'total_org_fora_do_mapa', (select coalesce(sum(outra), 0) from linhas)
  ),

  'sessoes_ativas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'ambiente', coalesce(s.environment::text, 'sem environment'),
             'organizacao', case
               when s.organization_id is null then 'nula'
               when s.organization_id::text = 'eaf29983-1998-40a4-bd07-03ea09b4adfa' then 'production'
               when s.organization_id::text = 'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd' then 'test'
               else 'outra'
             end,
             'quantidade', s.qtd
           ) order by 1, 2), '[]'::jsonb)
      from (
        select s.environment, s.organization_id, count(*) as qtd
          from public.user_sessions s
         where s.logout_at is null
         group by 1, 2
      ) s
  ),

  'por_tabela', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'tabela', l.tabela,
             'total', l.total,
             'org_demo', l.demo,
             'org_producao', l.prod,
             'org_nula', l.nula,
             'org_outra', l.outra,
             'env_test', l.envtest,
             'env_production', l.envprod
           ) order by l.tabela), '[]'::jsonb)
      from linhas l
  ),

  'como_ler', 'org_demo = 0 com org_producao > 0 significa tabela so com dados de production: em test a tela pode aparecer vazia, e isso e esperado. org_outra > 0 e org_nula > 0 indicam linha fora do mapa de tenant.'
)) as resumo;

rollback;

-- VERIFY — braço `test` compartilhado (T4b)
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test.
-- Executar logo após docs/FORWARD-ESCOPO-RLS-TESTE-20261126.sql.

begin;

select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',

  'config_teste', (
    select coalesce(
             jsonb_agg(jsonb_build_object('environment', s.environment, 'value', s.value)),
             '[]'::jsonb
           )
      from public.system_settings s
     where s.key = 'tenant_test_scope'
       and s.environment in ('production', 'test')
  ),

  'policies_criadas', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'tabela', p.tablename,
                 'policyname', p.policyname,
                 'permissive', p.permissive,
                 'cmd', p.cmd,
                 'qual', p.qual,
                 'with_check', p.with_check
               )
               order by p.tablename
             ),
             '[]'::jsonb
           )
      from pg_policies p
     where p.schemaname = 'public'
       and p.policyname = 'P0 tenant teste compartilhado'
  ),

  'policies', jsonb_build_object(
    'total', (select count(*) from pg_policies where schemaname = 'public'),
    'com_true_literal', (
      select count(*)
        from pg_policies
       where schemaname = 'public'
         and (
           lower(btrim(coalesce(qual, ''))) = 'true'
           or lower(btrim(coalesce(with_check, ''))) = 'true'
         )
    )
  ),

  'contagens_por_ambiente', (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'tabela', x.tabela,
                 'environment', x.environment,
                 'linhas', x.linhas,
                 'organizacoes_distintas', x.organizacoes_distintas
               )
               order by x.tabela, x.environment
             ),
             '[]'::jsonb
           )
      from (
        select 'contracts'::text as tabela, environment,
               count(*) as linhas,
               count(distinct organization_id) as organizacoes_distintas
          from public.contracts
         where environment in ('production', 'test')
         group by environment
        union all
        select 'clients'::text, environment,
               count(*), count(distinct organization_id)
          from public.clients
         where environment in ('production', 'test')
         group by environment
        union all
        select 'payments'::text, environment,
               count(*), count(distinct organization_id)
          from public.payments
         where environment in ('production', 'test')
         group by environment
      ) x
  ),

  'esperado', jsonb_build_object(
    'politicas_com_true_literal', 0,
    'producao_inalterada', true,
    'teste_compartilhado', true,
    'linhas_de_negocio_alteradas', 0
  )
)) as resumo;

rollback;

-- VERIFY - limpeza das tabelas historicas de backup
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Executar logo apos docs/FORWARD-LIMPEZA-BACKUPS-20261126.sql.

begin;

select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),

  'ambiente_declarado', 'production + test',

  'backup_logs', jsonb_build_object(
    'existe', to_regclass('public.backup_logs') is not null,
    'linhas', (select count(*) from public.backup_logs)
  ),

  'tabelas_com_backup_restantes', (
    select coalesce(
             jsonb_agg(table_name::text order by table_name::text),
             '[]'::jsonb
           )
      from information_schema.tables
     where table_schema = 'public'
       and table_type = 'BASE TABLE'
       and table_name like '%backup%'
  ),

  'removidas_ainda_presentes', (
    select coalesce(jsonb_agg(nome order by nome), '[]'::jsonb)
      from (values
        ('_auth_hardening_policy_backup_20261118'),
        ('backup_b11_projecao_20261121'),
        ('backup_contracts_20261121'),
        ('backup_contracts_status_endurecimento_20261121'),
        ('backup_contratos_protecao_20261125'),
        ('backup_estornado_recebivel_20261126'),
        ('backup_estornado_recebivel_dados_20261126'),
        ('backup_installments_20261121'),
        ('backup_payments_20261121'),
        ('backup_recebimento_desdobramento_20261125'),
        ('backup_test_ajuste_final_20261121'),
        ('backup_test_ajuste_final_pagamentos_20261121'),
        ('backup_test_contracts_conciliacao_20261121'),
        ('backup_test_installments_conciliacao_20261121'),
        ('backup_test_pagamentos_conciliacao_20261121'),
        ('backup_view_receivables_20261121'),
        ('birthday_templates_backup')
      ) as v(nome)
     where to_regclass('public.' || nome) is not null
  ),

  'views_e_funcoes_com_backup_no_texto', (
    select count(*)
      from (
        select pg_get_viewdef(c.oid) as def
          from pg_class c
         where c.relnamespace = 'public'::regnamespace
           and c.relkind in ('v', 'm')
        union all
        select p.prosrc
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
      ) d
     where d.def ilike '%backup%'
  ),

  'totais', jsonb_build_object(
    'tabelas_public', (
      select count(*)
        from information_schema.tables
       where table_schema = 'public'
         and table_type = 'BASE TABLE'
    ),
    'policies', (select count(*) from pg_policies where schemaname = 'public')
  ),

  'esperado', jsonb_build_object(
    'tabelas_com_backup_restantes', '["backup_logs"]'::jsonb,
    'removidas_ainda_presentes', '[]'::jsonb,
    'views_e_funcoes_com_backup_no_texto', 0,
    'tabelas_public', 56,
    'policies', 62,
    'linhas_de_negocio_alteradas', 0
  )
)) as resumo;

rollback;

-- VERIFY - indice/constraint unica de system_settings antes do item 3
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Nao mostra valores de configuracao, apenas definicoes de indice,
-- versao do Postgres e contagens agregadas.

begin;

select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'versao_postgres', current_setting('server_version'),
  'suporta_nulls_not_distinct', current_setting('server_version_num')::integer >= 150000,
  'colunas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'coluna', a.attname,
             'tipo', format_type(a.atttypid, a.atttypmod),
             'nulo', a.attnotnull = false
           ) order by a.attnum), '[]'::jsonb)
      from pg_attribute a
     where a.attrelid = 'public.system_settings'::regclass
       and a.attnum > 0
       and not a.attisdropped
  ),
  'indices', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nome', i.relname,
             'definicao', pg_get_indexdef(i.oid),
             'unico', idx.indisunique,
             'primario', idx.indisprimary,
             'predicado', pg_get_expr(idx.indpred, idx.indrelid)
           ) order by i.relname), '[]'::jsonb)
      from pg_class i
      join pg_index idx on idx.indexrelid = i.oid
     where idx.indrelid = 'public.system_settings'::regclass
  ),
  'constraints', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nome', con.conname,
             'tipo', con.contype,
             'definicao', pg_get_constraintdef(con.oid)
           ) order by con.conname), '[]'::jsonb)
      from pg_constraint con
     where con.conrelid = 'public.system_settings'::regclass
  ),
  'contagens', (
    select jsonb_build_object(
      'total', count(*),
      'com_organization_id', count(*) filter (where organization_id is not null),
      'sem_organization_id', count(*) filter (where organization_id is null),
      'production', count(*) filter (where environment = 'production'),
      'test', count(*) filter (where environment = 'test')
    )
      from public.system_settings
  ),
  'duplicatas_key_environment', (
    select count(*) from (
      select key, environment from public.system_settings
       group by key, environment having count(*) > 1
    ) d
  )
)) as resumo;

rollback;

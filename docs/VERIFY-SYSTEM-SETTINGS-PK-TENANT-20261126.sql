-- VERIFY - chave tenant de system_settings apos o FORWARD
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Nao mostra valores de configuracao: apenas definicoes e agregados.

begin;

select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'versao_postgres', current_setting('server_version'),

  'unique_tenant_presente', coalesce((
      select contype = 'u'
         and pg_get_constraintdef(oid) ilike '%NULLS NOT DISTINCT%'
        from pg_constraint
       where conrelid = 'public.system_settings'::regclass
         and conname = 'uq_system_settings_key_environment_organization'
  ), false),

  'definicao_unique', (
      select pg_get_constraintdef(oid)
        from pg_constraint
       where conrelid = 'public.system_settings'::regclass
         and conname = 'uq_system_settings_key_environment_organization'
  ),

  'pk_antiga_removida', not coalesce((
      select exists (
        select 1 from pg_constraint
         where conrelid = 'public.system_settings'::regclass
           and conname = 'system_settings_pkey'
           and contype = 'p'
      )
  ), false),

  'organization_id_permite_nulo', coalesce((
      select attnotnull = false
        from pg_attribute
       where attrelid = 'public.system_settings'::regclass
         and attname = 'organization_id'
         and not attisdropped
  ), false),

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
      select key, environment
        from public.system_settings
       group by key, environment
      having count(*) > 1
    ) d
  ),

  'duplicatas_key_environment_organization', (
    select count(*) from (
      select key, environment, organization_id
        from public.system_settings
       group by key, environment, organization_id
      having count(*) > 1
    ) d
  ),

  'pronto_para_onconflict', (
       coalesce((
         select exists (
           select 1 from pg_constraint
            where conrelid = 'public.system_settings'::regclass
              and conname = 'uq_system_settings_key_environment_organization'
              and contype = 'u'
         )
       ), false)
       and not coalesce((
         select exists (
           select 1 from pg_constraint
            where conrelid = 'public.system_settings'::regclass
              and conname = 'system_settings_pkey'
              and contype = 'p'
         )
       ), false)
       and (
         select count(*) = 0 from (
           select key, environment, organization_id
             from public.system_settings
            group by key, environment, organization_id
           having count(*) > 1
         ) d
       )
       and current_setting('server_version_num')::integer >= 150000
  )
)) as resumo;

rollback;

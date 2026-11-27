-- VERIFY - composicao das linhas ainda pendentes de backfill
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
-- Traz apenas contagens por tabela/ambiente, sem dados de negocio.
--
-- Usado para definir a composicao exata do LOTE 5 a partir do estado ao vivo.

begin;

do $$
declare
  r record;
  v_prod bigint;
  v_test bigint;
  v_arr jsonb := '[]'::jsonb;
begin
  for r in
    select c.relname as tabela
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relname not like '\_%'
       and exists (
         select 1 from pg_attribute a
          where a.attrelid = c.oid
            and a.attname = 'organization_id'
            and not a.attisdropped
       )
       and exists (
         select 1 from pg_attribute a
          where a.attrelid = c.oid
            and a.attname = 'environment'
            and not a.attisdropped
       )
     order by c.relname
  loop
    execute format(
      'select count(*) filter (where organization_id is null and environment = ''production''), ' ||
      '       count(*) filter (where organization_id is null and environment = ''test'') ' ||
      '  from public.%I', r.tabela
    ) into v_prod, v_test;

    if v_prod + v_test > 0 then
      v_arr := v_arr || jsonb_build_object(
        'tabela', r.tabela,
        'production', v_prod,
        'test', v_test,
        'total', v_prod + v_test
      );
    end if;
  end loop;

  perform set_config('verify.pendentes', v_arr::text, true);
end $$;

select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'total_pendente', (
    select coalesce(sum((x->>'total')::bigint), 0)
      from jsonb_array_elements(
        coalesce(nullif(current_setting('verify.pendentes', true), '')::jsonb, '[]'::jsonb)
      ) x
  ),
  'por_tabela', coalesce(
    nullif(current_setting('verify.pendentes', true), '')::jsonb, '[]'::jsonb
  )
)) as resumo;

rollback;

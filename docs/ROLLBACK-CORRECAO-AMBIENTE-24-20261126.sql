-- ROLLBACK - correcao de environment dos 24 registros
-- 26/11/2026
--
-- Desfaz somente o que docs/FORWARD-CORRECAO-AMBIENTE-24-20261126.sql fez:
--   - devolve environment = production nas 24 linhas capturadas;
--   - apaga a tabela de backup usada nessa operacao.
-- Nao toca organization_id nem qualquer outra linha.
--
-- Ambiente declarado: production + test (banco unico).

begin;

do $$
declare
  r record;
  v_sql text;
  v_tipo text;
  v_n bigint;
  v_total bigint := 0;
  v_backup bigint;
begin
  if to_regclass('public._correcao_ambiente_24_20261126') is null then
    raise exception 'Nada a desfazer: tabela de backup nao existe';
  end if;

  select count(*) into v_backup
    from public._correcao_ambiente_24_20261126;

  if v_backup <> 24 then
    raise exception 'Abortando: backup tem % linhas, esperado 24', v_backup;
  end if;

  for r in
    select distinct tabela
      from public._correcao_ambiente_24_20261126
     order by tabela
  loop
    execute format(
      'select pg_typeof(t.environment)::text from public.%I t limit 1',
      r.tabela
    ) into v_tipo;

    v_sql := format($q$
      update public.%I t
         set environment = b.environment_anterior::%s
        from public._correcao_ambiente_24_20261126 b
       where b.tabela = %L
         and to_jsonb(t) @> b.pk
    $q$, r.tabela, v_tipo, r.tabela);

    execute v_sql;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  if v_total <> 24 then
    raise exception 'Abortando: restaurou % linhas, esperado 24', v_total;
  end if;

  raise notice 'Rollback concluido: % linhas restauradas', v_total;
end $$;

drop table public._correcao_ambiente_24_20261126;

commit;

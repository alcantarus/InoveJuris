-- ROLLBACK - backfill do LOTE 2 (71 linhas)
-- 26/11/2026
--
-- Desfaz somente o que docs/FORWARD-BACKFILL-LOTE-02-20261126.sql fez:
--   - devolve organization_id = NULL nas 71 linhas capturadas;
--   - apaga a tabela de backup usada nesse lote.
-- Nao toca nenhuma outra tabela nem linha.
--
-- Ambiente declarado: production + test (banco unico).

begin;

do $$
declare
  r record;
  v_sql text;
  v_n bigint;
  v_total bigint := 0;
  v_backup bigint;
begin
  if to_regclass('public._backfill_lote02_20261126') is null then
    raise exception 'Nada a desfazer: backup do Lote 2 nao existe';
  end if;

  select count(*) into v_backup
    from public._backfill_lote02_20261126;

  if v_backup <> 71 then
    raise exception 'Abortando: backup tem % linhas, esperado 71', v_backup;
  end if;

  for r in
    select distinct tabela
      from public._backfill_lote02_20261126
     order by tabela
  loop
    v_sql := format($q$
      update public.%I t
         set organization_id = b.organization_id_anterior
        from public._backfill_lote02_20261126 b
       where b.tabela = %L
         and to_jsonb(t) @> b.pk
    $q$, r.tabela, r.tabela);

    execute v_sql;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  if v_total <> 71 then
    raise exception 'Abortando: restaurou % linhas, esperado 71', v_total;
  end if;

  raise notice 'Rollback Lote 2 concluido: % linhas restauradas', v_total;
end $$;

drop table public._backfill_lote02_20261126;

commit;

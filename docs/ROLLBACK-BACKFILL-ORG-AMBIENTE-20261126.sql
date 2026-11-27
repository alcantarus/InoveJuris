-- ROLLBACK - backfill organization_id por environment
-- 26/11/2026
--
-- Desfaz somente o que docs/FORWARD-BACKFILL-ORG-AMBIENTE-20261126.sql fez:
--   - devolve organization_id = NULL para as linhas capturadas no backup;
--   - apaga a tabela de backup usada nessa operacao.
-- Nao toca linhas que ja estavam preenchidas antes do forward.
--
-- Ambiente declarado: production + test (banco unico).

begin;

do $$
declare
  r record;
  v_sql text;
  v_n bigint;
  v_total bigint := 0;
begin
  if to_regclass('public._backfill_org_ambiente_20261126') is null then
    raise exception 'Nada a desfazer: tabela de backup nao existe';
  end if;

  for r in
    select distinct tabela
      from public._backfill_org_ambiente_20261126
     order by tabela
  loop
    v_sql := format($q$
      update public.%I t
         set organization_id = b.organization_id_anterior
        from public._backfill_org_ambiente_20261126 b
       where b.tabela = %L
         and to_jsonb(t) @> b.pk
    $q$, r.tabela, r.tabela);
    execute v_sql;
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;

  raise notice 'Rollback concluido: % linhas restauradas', v_total;
end $$;

drop table public._backfill_org_ambiente_20261126;

commit;

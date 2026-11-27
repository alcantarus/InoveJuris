-- ROLLBACK - backfill do LOTE 6 (1070 linhas) - ULTIMO LOTE
-- 26/11/2026
--
-- Desfaz somente o que docs/FORWARD-BACKFILL-LOTE-06-20261126.sql fez:
--   - devolve organization_id = NULL nas 1070 linhas capturadas;
--   - apaga a tabela de backup usada nesse lote.
-- Nao toca nenhuma outra tabela nem linha.
--
-- Assim como no FORWARD, as triggers publicas habilitadas com evento UPDATE
-- em financial_transactions sao desativadas somente durante o UPDATE e
-- reativadas antes do commit (ou em caso de erro).
--
-- Ambiente declarado: production + test (banco unico).

begin;

do $$
declare
  v_nome text;
  v_trigs text[] := array[]::text[];
  r record;
  v_n bigint;
  v_total bigint := 0;
  v_backup bigint;
begin
  if to_regclass('public._backfill_lote06_20261126') is null then
    raise exception 'Nada a desfazer: backup do Lote 6 nao existe';
  end if;

  select count(*) into v_backup
    from public._backfill_lote06_20261126;

  if v_backup <> 1070 then
    raise exception 'Abortando: backup tem % linhas, esperado 1070', v_backup;
  end if;

  for r in
    select t.tgname::text as nome
      from pg_trigger t
     where t.tgrelid = 'public.financial_transactions'::regclass
       and not t.tgisinternal
       and (t.tgtype & 8) <> 0
       and t.tgenabled = 'O'
     order by t.tgname
  loop
    execute format('alter table public.financial_transactions disable trigger %I', r.nome);
    v_trigs := v_trigs || r.nome;
  end loop;

  begin
    update public.financial_transactions t
       set organization_id = b.organization_id_anterior
      from public._backfill_lote06_20261126 b
     where t.id = (b.pk ->> 'id')::bigint;

    get diagnostics v_n = row_count;
    v_total := v_n;
  exception when others then
    foreach v_nome in array v_trigs loop
      execute format('alter table public.financial_transactions enable trigger %I', v_nome);
    end loop;
    raise;
  end;

  foreach v_nome in array v_trigs loop
    execute format('alter table public.financial_transactions enable trigger %I', v_nome);
  end loop;

  if v_total <> 1070 then
    raise exception 'Abortando: restaurou % linhas, esperado 1070', v_total;
  end if;

  raise notice 'Rollback Lote 6 concluido: % linhas restauradas; % triggers reativadas', v_total, coalesce(array_length(v_trigs, 1), 0);
end $$;

drop table public._backfill_lote06_20261126;

commit;

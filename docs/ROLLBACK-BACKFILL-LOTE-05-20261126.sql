-- ROLLBACK - backfill do LOTE 5 (512 linhas)
-- 26/11/2026
--
-- Desfaz somente o que docs/FORWARD-BACKFILL-LOTE-05-20261126.sql fez:
--   - devolve organization_id = NULL nas 512 linhas capturadas;
--   - apaga a tabela de backup usada nesse lote.
-- Nao toca nenhuma outra tabela nem linha.
--
-- As mesmas 4 triggers do FORWARD sao desativadas somente durante o UPDATE
-- e reativadas antes do commit, para nao gerar audit_logs nem UPDATE em
-- contracts durante o desfazimento.
--
-- Ambiente declarado: production + test (banco unico).

begin;

do $$
declare
  r record;
  v_sql text;
  v_estado "char";
  v_n bigint;
  v_total bigint := 0;
  v_backup bigint;
begin
  if to_regclass('public._backfill_lote05_20261126') is null then
    raise exception 'Nada a desfazer: backup do Lote 5 nao existe';
  end if;

  select count(*) into v_backup
    from public._backfill_lote05_20261126;

  if v_backup <> 512 then
    raise exception 'Abortando: backup tem % linhas, esperado 512', v_backup;
  end if;

  for r in
    select * from (values
      ('payments',      'audit_payments'),
      ('payments',      'trg_recalculate_contract_on_payment'),
      ('notifications', 'audit_notifications'),
      ('user_sessions', 'audit_user_sessions')
    ) as x(tabela, trigger)
  loop
    select t.tgenabled
      into v_estado
      from pg_trigger t
     where t.tgrelid = ('public.' || quote_ident(r.tabela))::regclass
       and t.tgname = r.trigger
       and not t.tgisinternal;

    if not found then
      raise exception 'Abortando: trigger %.% nao existe', r.tabela, r.trigger;
    end if;

    if v_estado <> 'O' then
      raise exception 'Abortando: trigger %.% nao esta habilitada (estado %)', r.tabela, r.trigger, v_estado;
    end if;

    execute format('alter table public.%I disable trigger %I', r.tabela, r.trigger);
  end loop;

  begin
    for r in
      select distinct tabela
        from public._backfill_lote05_20261126
       order by tabela
    loop
      v_sql := format($q$
        update public.%I t
           set organization_id = b.organization_id_anterior
          from public._backfill_lote05_20261126 b
         where b.tabela = %L
           and to_jsonb(t) @> b.pk
      $q$, r.tabela, r.tabela);

      execute v_sql;
      get diagnostics v_n = row_count;
      v_total := v_total + v_n;
    end loop;
  exception when others then
    for r in
      select * from (values
        ('payments',      'audit_payments'),
        ('payments',      'trg_recalculate_contract_on_payment'),
        ('notifications', 'audit_notifications'),
        ('user_sessions', 'audit_user_sessions')
      ) as x(tabela, trigger)
    loop
      execute format('alter table public.%I enable trigger %I', r.tabela, r.trigger);
    end loop;
    raise;
  end;

  for r in
    select * from (values
      ('payments',      'audit_payments'),
      ('payments',      'trg_recalculate_contract_on_payment'),
      ('notifications', 'audit_notifications'),
      ('user_sessions', 'audit_user_sessions')
    ) as x(tabela, trigger)
  loop
    execute format('alter table public.%I enable trigger %I', r.tabela, r.trigger);
  end loop;

  if v_total <> 512 then
    raise exception 'Abortando: restaurou % linhas, esperado 512', v_total;
  end if;

  raise notice 'Rollback Lote 5 concluido: % linhas restauradas', v_total;
end $$;

drop table public._backfill_lote05_20261126;

commit;

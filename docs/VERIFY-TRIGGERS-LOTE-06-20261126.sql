-- VERIFY - triggers de financial_transactions antes do LOTE 6
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Objetivo: descobrir se financial_transactions tem trigger de UPDATE
-- habilitada que possa bloquear o backfill ou gerar efeito colateral
-- (audit_logs, recalculos), como aconteceu no Lote 5.
--
-- Nao mostra codigo de funcao, so nomes, eventos e estado.

begin;

with triggers_da_tabela as (
  select c.relname::text as tabela,
         t.tgname::text as trigger,
         t.tgenabled::text as estado,
         (t.tgenabled = 'O') as habilitada,
         (t.tgtype & 2) <> 0 as dispara_insert,
         (t.tgtype & 8) <> 0 as dispara_update,
         (t.tgtype & 4) <> 0 as dispara_delete,
         (t.tgtype & 16) <> 0 as dispara_truncate,
         format('%I.%I', n.nspname, p.proname) as funcao,
         pg_get_expr(t.tgqual, t.tgrelid) as condicao_when
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace ns on ns.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
   where ns.nspname = 'public'
     and c.relname = 'financial_transactions'
     and not t.tgisinternal
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'tabela', 'financial_transactions',
  'total_triggers', (select count(*) from triggers_da_tabela),
  'triggers_update', (select count(*) from triggers_da_tabela where dispara_update),
  'update_habilitadas', (select count(*) from triggers_da_tabela where dispara_update and habilitada),
  'desabilitadas', (select count(*) from triggers_da_tabela where not habilitada),
  'detalhe', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'trigger', d.trigger,
             'estado', d.estado,
             'habilitada', d.habilitada,
             'eventos', array_remove(array[
               case when d.dispara_insert then 'INSERT' end,
               case when d.dispara_update then 'UPDATE' end,
               case when d.dispara_delete then 'DELETE' end,
               case when d.dispara_truncate then 'TRUNCATE' end
             ], null::text),
             'funcao', d.funcao,
             'when', coalesce(d.condicao_when, '')
           ) order by d.trigger), '[]'::jsonb)
      from triggers_da_tabela d
  )
)) as resumo;

rollback;

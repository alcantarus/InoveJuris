-- VERIFY - triggers das tabelas do LOTE 5 antes do backfill
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Sem tabelas temporarias: compativel com o SQL Editor do Supabase.
--
-- Objetivo: descobrir se payments, notifications ou user_sessions tem trigger
-- de UPDATE habilitada que possa bloquear o backfill (como aconteceu com
-- prevent_update_delete_paid_installment_trigger em installments no Lote 4).
--
-- Nao mostra codigo de funcao, so nomes, eventos e estado.
-- Esperado para seguir: nenhuma trigger de UPDATE habilitada nessas tabelas,
-- ou apenas triggers conhecidas e liberadas pelo checkout da previa.

begin;

with triggers_das_tabelas as (
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
     and c.relname in ('payments', 'notifications', 'user_sessions')
     and not t.tgisinternal
),
por_tabela as (
  select x.tabela,
         count(*) as total_triggers,
         count(*) filter (where x.dispara_update) as triggers_update,
         count(*) filter (where x.dispara_update and x.habilitada) as update_habilitadas,
         count(*) filter (where not x.habilitada) as desabilitadas
    from triggers_das_tabelas x
   group by x.tabela
)
select jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),
  'ambiente_declarado', 'production + test',
  'por_tabela', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'tabela', t.tabela,
             'total_triggers', t.total_triggers,
             'triggers_update', t.triggers_update,
             'update_habilitadas', t.update_habilitadas,
             'desabilitadas', t.desabilitadas
           ) order by t.tabela), '[]'::jsonb)
      from por_tabela t
  ),
  'detalhe', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'tabela', d.tabela,
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
           ) order by d.tabela, d.trigger), '[]'::jsonb)
      from triggers_das_tabelas d
  ),
  'total_update_habilitadas', (
    select count(*) from triggers_das_tabelas d
     where d.dispara_update and d.habilitada
  )
)) as resumo;

rollback;

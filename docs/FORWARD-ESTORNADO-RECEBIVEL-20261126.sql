-- FORWARD — `Estornado` como título a receber (parte estrutural)
-- 26/11/2026
--
-- REGRA APROVADA PELO USUÁRIO: estorno desfaz recebimento equivocado; a parcela
-- volta à condição de devedora, a receber. Medição prévia em
-- docs/MEDICAO-ESTORNADO-RECEBIVEL-20261126.sql (executada em 12:38:50 UTC).
--
-- REGRA PERMANENTE: um único banco; production e test são valores da coluna
-- environment, não bancos separados. Ver
-- docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- O que muda (somente DDL de view/function):
--   1. view contract_receivables_summary: remove 'estornado' dos 4 filtros;
--   2. trigger fn_recalculate_contract_totals v4: remove 'estornado' do filtro
--      de amountReceivable (MANTÉM o ramo que rotula o contrato como Estornado);
--   3. views vw_dashboard_receivables_forecast, _receivables_metrics e
--      _top_defaulters: removem 'Estornado'/'Estornada' das exclusões.
--
-- O que NÃO muda:
--   - nenhum UPDATE/DELETE em dados de negócio;
--   - o rótulo/status 'Estornado' da parcela e do contrato;
--   - process_installment_payment (2 sobrecargas) e process_installment_estorno:
--     a medição confirmou que elas não excluem estornado do recebível — o gatilho
--     v4 é quem recalcula;
--   - rpc_recebimento_com_desdobramento v8 (já aceita estorno limpo desde 25/11);
--   - KPI "Recebido este Mês" (lib/payments.ts);
--   - 'Prorrogada' fora de 'vencido' (decisão do item 1);
--   - security_invoker das views (preservado a partir de reloptions).
--
-- PRÉ-VALIDAÇÃO: aborta antes de qualquer alteração se o estado atual não for
-- o esperado. Backup das definições em tabela de apoio, gravado uma única vez
-- (ON CONFLICT DO NOTHING) para que o rollback sempre restaure o original.
--
-- NÃO EXECUTAR SEM AUTORIZAÇÃO EXPLÍCITA DO USUÁRIO.
-- Depois: docs/VERIFY-ESTORNADO-RECEBIVEL-20261126.sql.
-- Para desfazer: docs/ROLLBACK-ESTORNADO-RECEBIVEL-20261126.sql.

begin;

-- 1) Backup das definições originais ----------------------------------------
create table if not exists public.backup_estornado_recebivel_20261126 (
  objeto       text primary key,
  nome         text not null,
  definicao    text,
  reloptions   text,
  capturado_em timestamptz not null default now()
);

insert into public.backup_estornado_recebivel_20261126
  (objeto, nome, definicao, reloptions)
select 'view:' || c.relname, c.relname,
       pg_get_viewdef(c.oid, true), coalesce(array_to_string(c.reloptions, ','), '')
  from pg_class c
 where c.oid in (
   to_regclass('public.contract_receivables_summary'),
   to_regclass('public.vw_dashboard_receivables_forecast'),
   to_regclass('public.vw_dashboard_receivables_metrics'),
   to_regclass('public.vw_dashboard_top_defaulters')
 )
on conflict (objeto) do nothing;

insert into public.backup_estornado_recebivel_20261126
  (objeto, nome, definicao, reloptions)
select 'function:' || p.proname || '()', p.proname,
       pg_get_functiondef(p.oid), null
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname = 'fn_recalculate_contract_totals'
on conflict (objeto) do nothing;

-- 2) Pré-validação do estado esperado ----------------------------------------
do $pre$
declare
  v_def   text;
  v_nome  text;
  v_total int := 0;
begin
  select pg_get_viewdef(to_regclass('public.contract_receivables_summary'), true)
    into v_def;
  if v_def is null or v_def not like '%''estornado''::text%' then
    raise exception 'Abortado: view contract_receivables_summary não está no estado esperado.';
  end if;

  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname = 'fn_recalculate_contract_totals';
  if v_def is null
     or v_def not like '%(''quitado'',''cancelado'',''cancelada'',''estornado'')%'
     or v_def not like '%v_has_estornado%' then
    raise exception 'Abortado: fn_recalculate_contract_totals não é a v4 esperada.';
  end if;

  foreach v_nome in array array[
    'vw_dashboard_receivables_forecast',
    'vw_dashboard_receivables_metrics',
    'vw_dashboard_top_defaulters'
  ]::text[]
  loop
    select pg_get_viewdef(to_regclass('public.' || v_nome), true) into v_def;
    if v_def is null or v_def not like '%''Estornado''::text%' then
      raise exception 'Abortado: view % não contém a exclusão esperada.', v_nome;
    end if;
    v_total := v_total + 1;
  end loop;

  if v_total <> 3 then
    raise exception 'Abortado: esperadas 3 views de dashboard; encontradas %.', v_total;
  end if;
end
$pre$;

-- 3) View de contas a receber ------------------------------------------------
do $vw$
declare
  v_def  text;
  v_new  text;
  v_opts text;
  v_with text;
begin
  select pg_get_viewdef(c.oid, true), coalesce(array_to_string(c.reloptions, ','), '')
    into v_def, v_opts
    from pg_class c
   where c.oid = to_regclass('public.contract_receivables_summary');

  v_new := replace(v_def, ', ''estornado''::text', '');
  if v_new = v_def then
    raise exception 'Abortado: não foi possível remover estornado da view.';
  end if;

  v_new  := regexp_replace(v_new, ';\s*$', '');
  v_with := case
    when v_opts ilike '%security_invoker=on%' then ' with (security_invoker = on)'
    else ''
  end;

  execute format(
    'create or replace view public.contract_receivables_summary%s as %s',
    v_with, v_new
  );
  raise notice 'View contract_receivables_summary atualizada (security_invoker preservado).';
end
$vw$;

-- 4) Trigger de recálculo do contrato ----------------------------------------
do $fn$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname = 'fn_recalculate_contract_totals';

  -- Altera somente o filtro de amountReceivable; preserva v_has_estornado,
  -- que continua rotulando o contrato como 'Estornado' (histórico).
  v_new := replace(
    v_def,
    '(''quitado'',''cancelado'',''cancelada'',''estornado'')',
    '(''quitado'',''cancelado'',''cancelada'')'
  );
  if v_new = v_def then
    raise exception 'Abortado: não foi possível remover estornado do filtro do gatilho.';
  end if;

  execute v_new;
  raise notice 'Gatilho v4 atualizado: amountReceivable inclui estornado; rótulo preservado.';
end
$fn$;

-- 5) Views de dashboard ------------------------------------------------------
do $dash$
declare
  r      record;
  v_def  text;
  v_new  text;
  v_with text;
  v_ok   int := 0;
begin
  for r in
    select c.relname,
           pg_get_viewdef(c.oid, true) as definicao,
           coalesce(array_to_string(c.reloptions, ','), '') as reloptions
      from pg_class c
     where c.oid in (
       to_regclass('public.vw_dashboard_receivables_forecast'),
       to_regclass('public.vw_dashboard_receivables_metrics'),
       to_regclass('public.vw_dashboard_top_defaulters')
     )
  loop
    v_new := replace(r.definicao, ', ''Estornado''::text, ''Estornada''::text', '');
    if v_new = r.definicao then
      raise exception 'Abortado: não foi possível remover Estornado de %.', r.relname;
    end if;

    v_new  := regexp_replace(v_new, ';\s*$', '');
    v_with := case
      when r.reloptions ilike '%security_invoker=on%' then ' with (security_invoker = on)'
      else ''
    end;

    execute format('create or replace view public.%I%s as %s', r.relname, v_with, v_new);
    v_ok := v_ok + 1;
  end loop;

  if v_ok <> 3 then
    raise exception 'Abortado: esperadas 3 views alteradas; foram %.', v_ok;
  end if;
  raise notice 'Três views de dashboard atualizadas.';
end
$dash$;

commit;

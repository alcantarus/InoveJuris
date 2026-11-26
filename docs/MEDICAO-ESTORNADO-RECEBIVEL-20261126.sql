-- MEDIÇÃO — `Estornado` como título a receber
-- 26/11/2026
--
-- DECISÃO DE NEGÓCIO DO USUÁRIO (26/11): estorno é desfazimento de recebimento
-- equivocado; ao desfazer, a parcela/título volta à condição de devedor, a
-- receber. Portanto `Estornado` precisa ser tratado como recebível em todo o
-- sistema — não apenas no lote.
--
-- REGRA PERMANENTE: um único banco; `production` e `test` são valores da coluna
-- `environment`, não bancos separados. Ver
-- docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Somente leitura. Uma única célula (`medicao_estornado_recebivel_20261126`).
-- Termina em ROLLBACK. Nenhuma linha de negócio é alterada.
--
-- Objetivo: medir o impacto antes de preparar forward/verify/rollback, sem
-- mexer em dados. As definições retornadas são necessárias para escrever o
-- forward sobre o estado real do banco (que pode diferir do código no repo).
--
-- Corrigido em 26/11 após erro 21000: funções com o mesmo nome podem ter mais
-- de uma assinatura. Os flags usam bool_or e as definições são agregadas, sem
-- subconsulta escalar que exija uma única linha.

begin;

with base as (
  select
    i.environment,
    i.id as installment_id,
    i.contract_id,
    coalesce(i.amount, 0) as amount,
    coalesce(i."amountPaid", 0) as paid,
    lower(btrim(coalesce(i.status, ''))) as st,
    i."dueDate" as due_date,
    lower(btrim(coalesce(c.status, ''))) as contract_status
  from public.installments i
  join public.contracts c on c.id = i.contract_id
),
por_ambiente as (
  select
    environment,
    count(*) filter (where st in ('estornado', 'estornada')) as estornadas,
    coalesce(sum(greatest(amount - paid, 0)) filter (
      where st in ('estornado', 'estornada')
        and contract_status not in ('cancelado', 'cancelada')
    ), 0) as saldo_estornado,
    count(*) filter (
      where st in ('estornado', 'estornada') and paid > 0
    ) as estornadas_com_pago_residual,
    count(*) filter (
      where st in ('estornado', 'estornada') and due_date < current_date
    ) as estornadas_vencidas,
    coalesce(sum(greatest(amount - paid, 0)) filter (
      where st in ('estornado', 'estornada')
        and due_date < current_date
        and contract_status not in ('cancelado', 'cancelada')
    ), 0) as saldo_estornado_vencido,
    count(distinct contract_id) filter (
      where st in ('estornado', 'estornada')
    ) as contratos_com_parcela_estornada,
    count(distinct contract_id) filter (
      where contract_status = 'estornado'
    ) as contratos_com_status_estornado,
    count(*) filter (
      where st not in ('quitado', 'cancelada', 'cancelado', 'estornado', 'estornada')
    ) as parcelas_elegiveis_lote_hoje,
    count(*) filter (
      where st not in ('quitado', 'cancelada', 'cancelado')
    ) as parcelas_elegiveis_lote_apos,
    coalesce(sum(greatest(amount - paid, 0)) filter (
      where due_date >= current_date
        and due_date <= current_date + 30
        and st in ('aberto', 'parcial', 'atrasada', 'prorrogada')
    ), 0) as previsao_30d_hoje,
    coalesce(sum(greatest(amount - paid, 0)) filter (
      where due_date >= current_date
        and due_date <= current_date + 30
        and st in ('aberto', 'parcial', 'atrasada', 'prorrogada', 'estornado', 'estornada')
    ), 0) as previsao_30d_apos
  from base
  group by environment
),
view_atual as (
  select
    environment,
    coalesce(sum(amount_to_receive), 0) as a_receber,
    coalesce(sum(overdue_amount), 0) as vencido
  from public.contract_receivables_summary
  group by environment
)
select jsonb_pretty(jsonb_build_object(

  'coletado_em', now(),
  'pg_version', current_setting('server_version'),
  'banco_unico', 'production e test são valores da coluna environment, não bancos separados.',
  'aviso', 'Somente leitura; nenhuma linha de negócio alterada. Termina em ROLLBACK.',
  'regra_aprovada', 'Estornado é título a receber; alinhar lote, view, trigger/funções e views de dashboard, sem alterar dados nem o rótulo do status.',

  'por_ambiente', coalesce((
    select jsonb_object_agg(
      coalesce(v.environment, p.environment),
      jsonb_build_object(
        'parcelas_estornadas', coalesce(p.estornadas, 0),
        'saldo_estornado', coalesce(p.saldo_estornado, 0),
        'estornadas_com_pago_residual', coalesce(p.estornadas_com_pago_residual, 0),
        'estornadas_vencidas', coalesce(p.estornadas_vencidas, 0),
        'saldo_estornado_vencido', coalesce(p.saldo_estornado_vencido, 0),
        'contratos_com_parcela_estornada', coalesce(p.contratos_com_parcela_estornada, 0),
        'contratos_com_status_estornado', coalesce(p.contratos_com_status_estornado, 0),
        'lote_elegiveis_hoje', coalesce(p.parcelas_elegiveis_lote_hoje, 0),
        'lote_elegiveis_apos', coalesce(p.parcelas_elegiveis_lote_apos, 0),
        'a_receber_view_hoje', coalesce(v.a_receber, 0),
        'a_receber_acrescimo', coalesce(p.saldo_estornado, 0),
        'a_receber_apos', coalesce(v.a_receber, 0) + coalesce(p.saldo_estornado, 0),
        'vencido_view_hoje', coalesce(v.vencido, 0),
        'vencido_acrescimo', coalesce(p.saldo_estornado_vencido, 0),
        'vencido_apos', coalesce(v.vencido, 0) + coalesce(p.saldo_estornado_vencido, 0),
        'previsao_30d_hoje', coalesce(p.previsao_30d_hoje, 0),
        'previsao_30d_apos', coalesce(p.previsao_30d_apos, 0)
      )
    )
    from view_atual v
    full join por_ambiente p on p.environment = v.environment
  ), '{}'::jsonb),

  -- Atenção: funções podem ter mais de uma assinatura (sobrecarga). Por isso
  -- os.flags usam bool_or e as definições são agregadas em array, sem LIMIT.
  'objetos_que_excluem_estornado', jsonb_build_object(
    'view_contract_receivables_summary', coalesce((
      select pg_get_viewdef(to_regclass('public.contract_receivables_summary'), true) ilike '%estornado%'
    ), false),
    'fn_recalculate_contract_totals', coalesce((
      select bool_or(pg_get_functiondef(p.oid) ilike '%estornado%')
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'fn_recalculate_contract_totals'
    ), false),
    'process_installment_payment', coalesce((
      select bool_or(pg_get_functiondef(p.oid) ilike '%estornado%')
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'process_installment_payment'
    ), false),
    'process_installment_estorno', coalesce((
      select bool_or(pg_get_functiondef(p.oid) ilike '%estornado%')
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'process_installment_estorno'
    ), false),
    'views_dashboard_com_exclusao', (
      select count(*)
      from pg_class c
      where c.oid in (
        to_regclass('public.vw_dashboard_receivables_forecast'),
        to_regclass('public.vw_dashboard_receivables_metrics'),
        to_regclass('public.vw_dashboard_top_defaulters')
      )
        and pg_get_viewdef(c.oid, true) ilike '%estornado%'
    ),
    'desdobramento_v8_aceita_estornado', coalesce((
      select bool_or(pg_get_functiondef(p.oid) ilike '%v8 20261125%')
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'rpc_recebimento_com_desdobramento'
    ), false)
  ),

  'definicoes', jsonb_build_object(
    'view_contract_receivables_summary', (
      select pg_get_viewdef(to_regclass('public.contract_receivables_summary'), true)
    ),
    'vw_dashboard_receivables_forecast', (
      select pg_get_viewdef(to_regclass('public.vw_dashboard_receivables_forecast'), true)
    ),
    'vw_dashboard_receivables_metrics', (
      select pg_get_viewdef(to_regclass('public.vw_dashboard_receivables_metrics'), true)
    ),
    'vw_dashboard_top_defaulters', (
      select pg_get_viewdef(to_regclass('public.vw_dashboard_top_defaulters'), true)
    ),
    'fn_recalculate_contract_totals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'args', pg_get_function_identity_arguments(p.oid),
        'definicao', pg_get_functiondef(p.oid)
      ) order by p.oid::text)
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'fn_recalculate_contract_totals'
    ), '[]'::jsonb),
    'process_installment_payment', coalesce((
      select jsonb_agg(jsonb_build_object(
        'args', pg_get_function_identity_arguments(p.oid),
        'definicao', pg_get_functiondef(p.oid)
      ) order by p.oid::text)
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'process_installment_payment'
    ), '[]'::jsonb),
    'process_installment_estorno', coalesce((
      select jsonb_agg(jsonb_build_object(
        'args', pg_get_function_identity_arguments(p.oid),
        'definicao', pg_get_functiondef(p.oid)
      ) order by p.oid::text)
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'process_installment_estorno'
    ), '[]'::jsonb),
    'rpc_recebimento_com_desdobramento', coalesce((
      select jsonb_agg(jsonb_build_object(
        'args', pg_get_function_identity_arguments(p.oid),
        'definicao', pg_get_functiondef(p.oid)
      ) order by p.oid::text)
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'rpc_recebimento_com_desdobramento'
    ), '[]'::jsonb)
  ),

  'funcoes_sobrecarregadas', coalesce((
    select jsonb_object_agg(q.proname, q.quantidade)
    from (
      select p.proname, count(*)::int as quantidade
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname in (
          'fn_recalculate_contract_totals',
          'process_installment_payment',
          'process_installment_estorno',
          'rpc_recebimento_com_desdobramento'
        )
      group by p.proname
      having count(*) > 1
    ) q
  ), '{}'::jsonb),

  'como_interpretar', jsonb_build_object(
    'impacto', 'a_receber_apos / vencido_apos / previsao_30d_apos mostram quanto os KPIs mudariam se estornado passasse a ser recebível.',
    'estimativa', 'Os acréscimos usam o saldo (amount - amountPaid) das parcelas estornadas de contratos não cancelados; a view aplica regras adicionais por status do contrato, então os números são estimativa prévia, não o resultado final.',
    'proximo_passo', 'Com esta medição e as definições reais, preparar forward/verify/rollback sem aplicar. Nenhuma mudança em dados de negócio.'
  )

)) as medicao_estornado_recebivel_20261126;

rollback;

-- VERIFY — `Estornado` como título a receber
-- 26/11/2026
--
-- Somente leitura, uma única célula (`verificacao_estornado_recebivel_20261126`),
-- termina em ROLLBACK. Rodar depois de
-- docs/FORWARD-ESTORNADO-RECEBIVEL-20261126.sql.
--
-- REGRA PERMANENTE: um único banco; production e test são valores da coluna
-- environment, não bancos separados.
--
-- Critério estrutural:
--   - view contract_receivables_summary sem 'estornado' e com security_invoker;
--   - gatilho v4 sem 'estornado' no filtro de amountReceivable, mas com o ramo
--     v_has_estornado preservado;
--   - 0 views de dashboard com 'Estornado' nas exclusões.
-- Critério de dados: as 3 parcelas estornadas de test continuam existindo com
-- o mesmo saldo de R$ 15.000,00 (nenhum UPDATE/DELETE).
-- Critério de KPI (valores medidos em 12:38:50 UTC):
--   test: a_receber 30000, vencido 19000, lote 10, previsão 30d 10000;
--   production: inalterado (320655.80 / 65270.00 / 50 / 19329.60).

begin;

with base as (
  select
    i.environment,
    i.id as installment_id,
    i.contract_id,
    coalesce(i.amount, 0) as amount,
    coalesce(i."amountPaid", 0) as paid,
    lower(btrim(coalesce(i.status, ''))) as st,
    i."dueDate" as due_date
  from public.installments i
),
por_ambiente as (
  select
    environment,
    count(*) filter (where st in ('estornado', 'estornada')) as estornadas,
    coalesce(sum(greatest(amount - paid, 0))
      filter (where st in ('estornado', 'estornada')), 0) as saldo_estornado,
    count(*) filter (
      where st not in ('quitado', 'cancelada', 'cancelado')
    ) as lote_elegiveis,
    coalesce(sum(greatest(amount - paid, 0)) filter (
      where due_date >= current_date
        and due_date <= current_date + 30
        and st in ('aberto', 'parcial', 'atrasada', 'prorrogada', 'estornado', 'estornada')
    ), 0) as previsao_30d
  from base
  group by environment
),
view_atual as (
  select environment,
         coalesce(sum(amount_to_receive), 0) as a_receber,
         coalesce(sum(overdue_amount), 0) as vencido
    from public.contract_receivables_summary
   group by environment
),
contratos as (
  select c.environment,
         count(*) filter (
           where exists (
             select 1 from public.installments i
              where i.contract_id = c.id
                and lower(btrim(coalesce(i.status, ''))) in ('estornado', 'estornada')
           )
         ) as contratos_com_estornado,
         count(*) filter (
           where exists (
             select 1 from public.installments i
              where i.contract_id = c.id
                and lower(btrim(coalesce(i.status, ''))) in ('estornado', 'estornada')
           )
             and abs(coalesce(c."amountReceivable", 0) - coalesce((
               select sum(greatest(
                        i.amount - coalesce(i."amountPaid", 0), 0
                      ))
                 from public.installments i
                where i.contract_id = c.id
                  and lower(btrim(coalesce(i.status, '')))
                      not in ('quitado', 'cancelado', 'cancelada')
             ), 0)) > 0.01
         ) as amount_receivable_desatualizado
    from public.contracts c
   group by c.environment
),
estrutura as (
  select
    coalesce((
      select array_to_string(c.reloptions, ',')
        from pg_class c
       where c.oid = to_regclass('public.contract_receivables_summary')
    ), '') as view_reloptions,
    coalesce((
      select pg_get_viewdef(to_regclass('public.contract_receivables_summary'), true)
    ), '') as view_def,
    coalesce((
      select pg_get_functiondef(p.oid)
        from pg_proc p
       where p.pronamespace = 'public'::regnamespace
         and p.proname = 'fn_recalculate_contract_totals'
    ), '') as fn_def,
    (
      select count(*)
        from pg_class c
       where c.oid in (
         to_regclass('public.vw_dashboard_receivables_forecast'),
         to_regclass('public.vw_dashboard_receivables_metrics'),
         to_regclass('public.vw_dashboard_top_defaulters')
       )
         and pg_get_viewdef(c.oid, true) ilike '%estornado%'
    ) as dashboards_com_estornado
)
select jsonb_pretty(jsonb_build_object(

  'verificado_em', now(),
  'pg_version', current_setting('server_version'),
  'banco_unico', 'production e test são valores da coluna environment, não bancos separados.',
  'aviso', 'Somente leitura; nenhuma linha de negócio alterada. Termina em ROLLBACK.',

  'estrutura', jsonb_build_object(
    'view_security_invoker_on', (select view_reloptions from estrutura) ilike '%security_invoker=on%',
    'view_sem_estornado', (select view_def from estrutura) not ilike '%estornado%',
    'gatilho_sem_estornado_no_filtro', (select fn_def from estrutura) not like '%(''quitado'',''cancelado'',''cancelada'',''estornado'')%',
    'gatilho_preserva_rotulo_estornado', (select fn_def from estrutura) like '%v_has_estornado%',
    'dashboards_com_estornado', (select dashboards_com_estornado from estrutura)
  ),

  'por_ambiente', coalesce((
    select jsonb_object_agg(
      coalesce(v.environment, p.environment),
      jsonb_build_object(
        'parcelas_estornadas', coalesce(p.estornadas, 0),
        'saldo_estornado', coalesce(p.saldo_estornado, 0),
        'a_receber', coalesce(v.a_receber, 0),
        'vencido', coalesce(v.vencido, 0),
        'lote_elegiveis', coalesce(p.lote_elegiveis, 0),
        'previsao_30d', coalesce(p.previsao_30d, 0),
        'contratos_com_estornado', coalesce(ct.contratos_com_estornado, 0),
        'amount_receivable_desatualizado', coalesce(ct.amount_receivable_desatualizado, 0)
      )
    )
    from view_atual v
    full join por_ambiente p on p.environment = v.environment
    full join contratos ct on ct.environment = coalesce(v.environment, p.environment)
  ), '{}'::jsonb),

  'conferencia_kpi', jsonb_build_object(
    'test_esperado', jsonb_build_object(
      'a_receber', 30000.00, 'vencido', 19000.00,
      'lote_elegiveis', 10, 'previsao_30d', 10000.00
    ),
    'production_esperado', jsonb_build_object(
      'a_receber', 320655.80, 'vencido', 65270.00,
      'lote_elegiveis', 50, 'previsao_30d', 19329.60
    ),
    'observacao', 'Valores de referência da medição prévia; pequenas variações por novas operações no app são esperadas. O critério decisivo é o estrutural.'
  ),

  'criterio_de_sucesso', jsonb_build_object(
    'estrutura', 'view_sem_estornado=true, view_security_invoker_on=true, gatilho_sem_estornado_no_filtro=true, gatilho_preserva_rotulo_estornado=true, dashboards_com_estornado=0.',
    'dados', 'test: parcelas_estornadas=3 e saldo_estornado=15000; production: 0 e 0. Se o forward de dados foi aplicado, amount_receivable_desatualizado=0 nos dois ambientes.',
    'se_divergir', 'Rodar docs/ROLLBACK-ESTORNADO-RECEBIVEL-20261126.sql e enviar o resultado.'
  )

)) as verificacao_estornado_recebivel_20261126;

rollback;

-- VERIFY — correção de vw_cash_flow_forecast
-- 26/11/2026
--
-- Somente leitura, uma única célula
-- (`verificacao_vw_cash_flow_forecast_20261126`), terminada em ROLLBACK.
-- Rodar depois de docs/FORWARD-VW-CASH-FLOW-FORECAST-20261126.sql.
--
-- REGRA PERMANENTE: um único banco; `production` e `test` são valores da
-- coluna `environment`, não bancos separados. Ver
-- docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Critério estrutural: 8 colunas na ordem original, security_invoker=on,
-- SELECT concedido a anon e authenticated, cálculo com saldo nas parciais.
-- Critério de resultado (medição prévia de 13:30:53 UTC):
--   production: 8 linhas / R$ 31.922,64 -> 7 linhas / R$ 30.122,64
--   test:       3 linhas / R$ 12.350,00 -> 2 linhas / R$ 11.000,00
--   parcela 140 (production, Parcial): 2.700,00 -> 900,00
--   parcela 227 (test, Estornado): 9.000,00 (inalterada)
--   parcela 238 (test, Cancelada): ausente
--   Quitado preservado: 2 em production e 1 em test
-- Se divergir, rodar docs/ROLLBACK-VW-CASH-FLOW-FORECAST-20261126.sql.

begin;

with vista as (
  select
    v.installment_id,
    v.contract_id,
    v.environment,
    v.status,
    coalesce(v.expected_amount, 0) as expected_amount,
    lower(btrim(coalesce(v.status, ''))) as st
  from public.vw_cash_flow_forecast v
),
contratos_cancelados as (
  select i.id as installment_id
    from public.installments i
    join public.contracts c on c.id = i.contract_id
   where lower(btrim(coalesce(c.status, ''))) in ('cancelado', 'cancelada')
),
por_ambiente as (
  select
    environment,
    count(*) as linhas,
    coalesce(sum(expected_amount), 0) as previsto,
    count(*) filter (where st = 'quitado') as quitadas,
    count(*) filter (where st in ('estornado', 'estornada')) as estornadas,
    count(*) filter (where st in ('cancelada', 'cancelado')) as canceladas_por_status,
    count(*) filter (
      where installment_id in (select installment_id from contratos_cancelados)
    ) as canceladas_por_contrato
  from vista
  group by environment
),
pontos as (
  select installment_id, environment, status, expected_amount
    from vista
   where installment_id in (140, 227, 238)
),
estrutura as (
  select
    c.oid,
    coalesce(array_to_string(c.reloptions, ','), '') as reloptions,
    coalesce(pg_get_viewdef(c.oid, true), '') as definicao
    from pg_class c
   where c.oid = to_regclass('public.vw_cash_flow_forecast')
),
colunas as (
  select coalesce(array_to_string(array_agg(a.attname order by a.attnum), ','), '') as nomes
    from pg_attribute a
   where a.attrelid = to_regclass('public.vw_cash_flow_forecast')
     and a.attnum > 0
     and not a.attisdropped
),
permissoes as (
  select
    has_table_privilege('anon', 'public.vw_cash_flow_forecast', 'SELECT') as anon_select,
    has_table_privilege('authenticated', 'public.vw_cash_flow_forecast', 'SELECT') as authenticated_select
)
select jsonb_pretty(jsonb_build_object(

  'verificado_em', now(),
  'pg_version', current_setting('server_version'),
  'banco_unico', 'production e test são valores da coluna environment, não bancos separados.',
  'ambientes_declarados', jsonb_build_array('production', 'test'),
  'aviso', 'Somente leitura; nenhuma linha de negócio alterada. Termina em ROLLBACK.',

  'estrutura', jsonb_build_object(
    'security_invoker_on', (select reloptions from estrutura) ilike '%security_invoker=on%',
    'colunas', (select nomes from colunas),
    'colunas_esperadas', 'installment_id,contract_id,due_date,amount,paid_amount,status,expected_amount,environment',
    'colunas_ok', (select nomes from colunas)
      = 'installment_id,contract_id,due_date,amount,paid_amount,status,expected_amount,environment',
    'anon_select', (select anon_select from permissoes),
    'authenticated_select', (select authenticated_select from permissoes),
    'usa_saldo_nas_parciais', (select definicao from estrutura) ilike '%greatest%'
      and (select definicao from estrutura) ilike '%"amountPaid"%',
    'view_existe', (select oid from estrutura) is not null
  ),

  'pontos', coalesce((
    select jsonb_object_agg(
      installment_id::text,
      jsonb_build_object(
        'environment', environment,
        'status', status,
        'expected_amount', expected_amount
      )
    )
    from pontos
  ), '{}'::jsonb),

  'por_ambiente', coalesce((
    select jsonb_object_agg(
      environment,
      jsonb_build_object(
        'linhas', linhas,
        'previsto', previsto,
        'quitadas', quitadas,
        'estornadas', estornadas,
        'canceladas_por_status', canceladas_por_status,
        'canceladas_por_contrato', canceladas_por_contrato
      )
    )
    from por_ambiente
  ), '{}'::jsonb),

  'conferencia', jsonb_build_object(
    'production_linhas', coalesce((select linhas from por_ambiente where environment = 'production'), -1),
    'production_linhas_esperado', 7,
    'production_previsto', coalesce((select previsto from por_ambiente where environment = 'production'), -1),
    'production_previsto_esperado', 30122.64,
    'test_linhas', coalesce((select linhas from por_ambiente where environment = 'test'), -1),
    'test_linhas_esperado', 2,
    'test_previsto', coalesce((select previsto from por_ambiente where environment = 'test'), -1),
    'test_previsto_esperado', 11000.00,
    'parcela_140_esperado', 900.00,
    'parcela_227_esperado', 9000.00,
    'parcela_238_deve_estar_ausente', true
  ),

  'criterio_de_sucesso', jsonb_build_object(
    'estrutura', 'view_existe=true, security_invoker_on=true, colunas_ok=true, anon_select=true, authenticated_select=true, usa_saldo_nas_parciais=true.',
    'resultado', 'production 7 linhas/30122.64; test 2 linhas/11000.00; parcela 140=900; parcela 227=9000; parcela 238 ausente; quitadas 2+1; 0 canceladas.',
    'observacao', 'Os totais são da medição prévia de 26/11. Operações novas no app podem alterar os números; o critério decisivo é o estrutural somado aos três pontos.',
    'se_divergir', 'Rodar docs/ROLLBACK-VW-CASH-FLOW-FORECAST-20261126.sql e enviar o resultado.'
  )

)) as verificacao_vw_cash_flow_forecast_20261126;

rollback;

-- APROFUNDAMENTO FORENSE — Módulo Fluxo de Caixa
-- 26/11/2026
--
-- Sequencia do diagnostico DIAGNOSTICO-FLUXO-CAIXA-20261126.sql, executado
-- as 13:25:28 UTC. Uma única celula (`aprofundamento_fluxo_caixa_20261126`),
-- somente leitura, termina em ROLLBACK. Nenhum UPDATE/DELETE.
--
-- REGRA PERMANENTE: um unico banco (PostgreSQL 17.6). `production` e `test`
-- sao valores da coluna `environment`, nao bancos separados. Toda secao
-- declara ou devolve o ambiente.
--
-- Reescrito como UMA consulta com CTEs: sem tabela temporaria e sem bloco DO,
-- por causa do 42P01 encontrado no SQL Editor nas versoes anteriores.
--
-- Objetivo: detalhar os achados confirmados antes de decidir a fonte de
-- verdade do saldo. Nao propoe correcao e nao altera dado de negocio.

begin;

with params as (
  select now() as coletado_em,
         current_setting('server_version') as pg_version,
         date_trunc('month', current_date)::date as ini,
         (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date as fim
),
ambientes(environment) as (
  values ('production'), ('test')
),
saldo_base as (
  select a.id as account_id,
         a.environment,
         a.name,
         a.initial_balance,
         a.current_balance,
         a.initial_balance
           + coalesce((select sum(f.amount) from public.financial_transactions f
                        where f.account_id = a.id
                          and lower(btrim(coalesce(f.type,''))) = 'income'), 0)
           - coalesce((select sum(f.amount) from public.financial_transactions f
                        where f.account_id = a.id
                          and lower(btrim(coalesce(f.type,''))) = 'expense'), 0)
           - coalesce((select sum(f.amount) from public.financial_transactions f
                        where f.account_id = a.id
                          and lower(btrim(coalesce(f.type,''))) = 'transfer'), 0)
           + coalesce((select sum(f.amount) from public.financial_transactions f
                        where f.destination_account_id = a.id
                          and lower(btrim(coalesce(f.type,''))) = 'transfer'), 0) as saldo_calculado
    from public.bank_accounts a
),
divergentes as (
  select * from saldo_base
   where abs(coalesce(current_balance, 0) - coalesce(saldo_calculado, 0)) > 0.01
),
logs_conta as (
  select d.account_id,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', q.id,
                    'action', q.action,
                    'performed_at', q.performed_at,
                    'performed_by', q.performed_by,
                    'environment', q.environment,
                    'old_current_balance', q.old_data ->> 'current_balance',
                    'new_current_balance', q.new_data ->> 'current_balance',
                    'changed_fields', q.changed_fields
                  ) order by q.performed_at desc, q.id desc)
             from (
               select l.*, row_number() over (order by l.performed_at desc, l.id desc) as rn
                 from public.audit_logs l
                where l.table_name = 'bank_accounts'
                  and l.record_id = d.account_id::text
             ) q
            where q.rn <= 20
         ), '[]'::jsonb) as valor
    from divergentes d
),
logs_transacoes as (
  select d.account_id,
         (select count(*)
            from public.audit_logs l
           where l.table_name = 'financial_transactions'
             and ( (l.new_data ->> 'account_id')::bigint = d.account_id
                or (l.old_data ->> 'account_id')::bigint = d.account_id
                or (l.new_data ->> 'destination_account_id')::bigint = d.account_id
                or (l.old_data ->> 'destination_account_id')::bigint = d.account_id
                )) as qtd,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', q.id,
                    'action', q.action,
                    'performed_at', q.performed_at,
                    'environment', q.environment,
                    'old_amount', q.old_data ->> 'amount',
                    'new_amount', q.new_data ->> 'amount',
                    'old_account_id', q.old_data ->> 'account_id',
                    'new_account_id', q.new_data ->> 'account_id',
                    'old_destination', q.old_data ->> 'destination_account_id',
                    'new_destination', q.new_data ->> 'destination_account_id'
                  ) order by q.performed_at desc, q.id desc)
             from (
               select l.*, row_number() over (order by l.performed_at desc, l.id desc) as rn
                 from public.audit_logs l
                where l.table_name = 'financial_transactions'
                  and ( (l.new_data ->> 'account_id')::bigint = d.account_id
                     or (l.old_data ->> 'account_id')::bigint = d.account_id
                     or (l.new_data ->> 'destination_account_id')::bigint = d.account_id
                     or (l.old_data ->> 'destination_account_id')::bigint = d.account_id
                     )
             ) q
            where q.rn <= 5
         ), '[]'::jsonb) as ultimos
    from divergentes d
),
contas_divergentes as (
  select coalesce((
    select jsonb_agg(jsonb_build_object(
             'environment', d.environment,
             'account_id', d.account_id,
             'conta', d.name,
             'inicial', d.initial_balance,
             'persistido', d.current_balance,
             'calculado', d.saldo_calculado,
             'delta', d.current_balance - d.saldo_calculado,
             'lancamentos_origem', (
               select count(*) from public.financial_transactions f
                where f.account_id = d.account_id
             ),
             'lancamentos_destino', (
               select count(*) from public.financial_transactions f
                where f.destination_account_id = d.account_id
             ),
             'logs_conta', (select valor from logs_conta lc where lc.account_id = d.account_id),
             'qtd_logs_transacoes', (select qtd from logs_transacoes lt where lt.account_id = d.account_id),
             'ultimos_logs_transacoes', (select ultimos from logs_transacoes lt where lt.account_id = d.account_id)
           ) order by d.environment, d.account_id)
      from divergentes d
  ), '[]'::jsonb) as valor
),
sem_conta as (
  select coalesce((
    select jsonb_agg(jsonb_build_object(
             'environment', f.environment,
             'id', f.id,
             'date', f.date,
             'amount', f.amount,
             'type', f.type,
             'category_id', f.category_id,
             'description', f.description,
             'created_at', f.created_at,
             'created_by', f.created_by
           ) order by f.environment, f.date, f.id)
      from public.financial_transactions f
     where f.account_id is null
  ), '[]'::jsonb) as valor
),
duplicados_grupos as (
  select environment,
         account_id,
         date,
         amount,
         lower(btrim(coalesce(type, ''))) as tipo,
         coalesce(description, '') as descricao,
         count(*) as n,
         min(created_at) as primeiro,
         max(created_at) as ultimo
    from public.financial_transactions
   group by environment, account_id, date, amount,
            lower(btrim(coalesce(type, ''))), coalesce(description, '')
  having count(*) > 1
),
duplicados as (
  select coalesce((
    select jsonb_agg(jsonb_build_object(
             'environment', g.environment,
             'account_id', g.account_id,
             'date', g.date,
             'amount', g.amount,
             'type', g.tipo,
             'description', g.descricao,
             'linhas', g.n,
             'primeiro_created_at', g.primeiro,
             'ultimo_created_at', g.ultimo,
             'ids', (
               select jsonb_agg(f.id order by f.id)
                 from public.financial_transactions f
                where f.environment is not distinct from g.environment
                  and f.account_id is not distinct from g.account_id
                  and f.date = g.date
                  and f.amount = g.amount
                  and lower(btrim(coalesce(f.type, ''))) = g.tipo
                  and coalesce(f.description, '') = g.descricao
             )
           ) order by g.environment, g.date, g.amount)
      from duplicados_grupos g
  ), '[]'::jsonb) as valor
),
pagamentos_divergentes as (
  select coalesce((
    select jsonb_agg(jsonb_build_object(
             'environment_pagamento', p.environment,
             'pagamento_id', p.id,
             'tipo', p.type,
             'valor', p.amount,
             'payment_date', p.payment_date,
             'parcela_id', p.installment_id,
             'conta_id', p.account_id,
             'conta', a.name,
             'environment_conta', a.environment,
             'descricao', p.description,
             'transacao_id', p.financial_transaction_id,
             'environment_transacao', (
               select f.environment from public.financial_transactions f
                where f.id = p.financial_transaction_id
             )
           ) order by p.environment, p.id)
      from public.payments p
      join public.bank_accounts a on a.id = p.account_id
     where p.environment is distinct from a.environment
  ), '[]'::jsonb) as valor
),
parcelas_div as (
  select i.id as parcela_id,
         i.environment,
         i.status,
         i.amount,
         i."amountPaid",
         coalesce(sum(p.amount) filter (
           where lower(btrim(coalesce(p.type, ''))) = 'payment'
         ), 0) as soma_pagamentos,
         coalesce(sum(p.amount) filter (
           where lower(btrim(coalesce(p.type, ''))) = 'reversal'
         ), 0) as soma_estornos,
         count(p.id) as qtd_pagamentos
    from public.installments i
    left join public.payments p on p.installment_id = i.id
   group by i.id, i.environment, i.status, i.amount, i."amountPaid"
  having abs(coalesce(i."amountPaid", 0) - coalesce(sum(p.amount) filter (
           where lower(btrim(coalesce(p.type, ''))) = 'payment'
         ), 0)) > 0.01
),
parcelas_detalhe as (
  select coalesce((
    select jsonb_agg(jsonb_build_object(
             'environment', d.environment,
             'parcela_id', d.parcela_id,
             'status', d.status,
             'amount', d.amount,
             'amountPaid', d."amountPaid",
             'soma_pagamentos', d.soma_pagamentos,
             'soma_estornos', d.soma_estornos,
             'divergencia', coalesce(d."amountPaid", 0) - d.soma_pagamentos,
             'contrato_id', (
               select i.contract_id from public.installments i
                where i.id = d.parcela_id
             ),
             'pagamentos', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', p.id,
                        'type', p.type,
                        'amount', p.amount,
                        'payment_date', p.payment_date,
                        'environment', p.environment,
                        'conta_id', p.account_id,
                        'financial_transaction_id', p.financial_transaction_id,
                        'description', p.description
                      ) order by p.payment_date, p.id)
                 from public.payments p
                where p.installment_id = d.parcela_id
             ), '[]'::jsonb)
           ) order by d.environment, d.parcela_id)
      from parcelas_div d
  ), '[]'::jsonb) as valor
),
previsao_status as (
  select coalesce((
    select jsonb_agg(jsonb_build_object(
             'environment', q.environment,
             'status', q.status,
             'linhas', q.linhas,
             'previsto', q.previsto,
             'valor_cheio', q.valor_cheio,
             'pago', q.pago,
             'contratos_cancelados', q.contratos_cancelados,
             'previsto_em_contratos_cancelados', q.previsto_cancelado,
             'estornadas', q.estornadas,
             'parciais_com_saldo', q.parciais_com_saldo
           ) order by q.environment, q.status)
      from (
        select v.environment,
               coalesce(v.status, '(nulo)') as status,
               count(*) as linhas,
               coalesce(sum(v.expected_amount), 0) as previsto,
               coalesce(sum(v.amount), 0) as valor_cheio,
               coalesce(sum(v.paid_amount), 0) as pago,
               count(*) filter (
                 where lower(coalesce(c.status, '')) in ('cancelado', 'cancelada')
               ) as contratos_cancelados,
               coalesce(sum(v.expected_amount) filter (
                 where lower(coalesce(c.status, '')) in ('cancelado', 'cancelada')
               ), 0) as previsto_cancelado,
               count(*) filter (
                 where lower(coalesce(v.status, '')) = 'estornado'
               ) as estornadas,
               count(*) filter (
                 where coalesce(v.paid_amount, 0) > 0
                   and coalesce(v.amount, 0) > coalesce(v.paid_amount, 0)
               ) as parciais_com_saldo
          from public.vw_cash_flow_forecast v
          left join public.contracts c on c.id = v.contract_id
         group by v.environment, coalesce(v.status, '(nulo)')
      ) q
  ), '[]'::jsonb) as valor
),
previsao_linhas as (
  select coalesce((
    select jsonb_agg(jsonb_build_object(
             'environment', v.environment,
             'parcela_id', v.installment_id,
             'status', v.status,
             'vencimento', v.due_date,
             'amount', v.amount,
             'paid_amount', v.paid_amount,
             'expected_amount', v.expected_amount,
             'status_contrato', c.status,
             'environment_contrato', c.environment
           ) order by v.environment, v.due_date, v.installment_id)
      from public.vw_cash_flow_forecast v
      left join public.contracts c on c.id = v.contract_id
     where lower(coalesce(c.status, '')) in ('cancelado', 'cancelada')
        or lower(coalesce(v.status, '')) = 'estornado'
        or (coalesce(v.paid_amount, 0) > 0
            and coalesce(v.amount, 0) > coalesce(v.paid_amount, 0))
  ), '[]'::jsonb) as valor
),
projecao as (
  select e.environment, q.due_month, q.total_amount
    from ambientes e
    cross join lateral public.get_future_receivables_projection(e.environment) q
),
previsao_comparativo as (
  select coalesce((
    select jsonb_object_agg(q.environment, jsonb_build_object(
             'projecao_mes_atual', coalesce((
               select sum(pr.total_amount) from projecao pr
                where pr.environment = q.environment
                  and pr.due_month = to_char(current_date, 'YYYY-MM')
             ), 0),
             'projecao_total', coalesce((
               select sum(pr.total_amount) from projecao pr
                where pr.environment = q.environment
             ), 0),
             'view_previsto_total', coalesce((
               select sum(v.expected_amount) from public.vw_cash_flow_forecast v
                where v.environment = q.environment
             ), 0),
             'view_linhas', (
               select count(*) from public.vw_cash_flow_forecast v
                where v.environment = q.environment
             )
           ))
      from (select environment from ambientes) q
  ), '{}'::jsonb) as valor
),
resumo as (
  select jsonb_build_object(
           'contas_divergentes', (select jsonb_array_length(valor) from contas_divergentes),
           'lancamentos_sem_conta', (select jsonb_array_length(valor) from sem_conta),
           'grupos_duplicados', (select jsonb_array_length(valor) from duplicados),
           'linhas_em_grupos_duplicados', (select coalesce(sum(n), 0) from duplicados_grupos),
           'pagamentos_ambiente_divergente', (select jsonb_array_length(valor) from pagamentos_divergentes),
           'parcelas_amountpaid_divergente', (select jsonb_array_length(valor) from parcelas_detalhe),
           'previsao_linhas_afetadas', (select jsonb_array_length(valor) from previsao_linhas)
         ) as valor
)
select jsonb_pretty(jsonb_build_object(
  'aviso', jsonb_build_object(
    'diagnostico', 'aprofundamento_fluxo_caixa_20261126',
    'origem', 'diagnostico_fluxo_caixa_20261126 executado as 13:25:28 UTC',
    'coletado_em', (select coletado_em from params),
    'pg_version', (select pg_version from params),
    'banco_unico', 'production e test sao valores da coluna environment, nao bancos separados.',
    'ambientes_consultados', (select jsonb_agg(environment) from ambientes),
    'periodo_mes_atual', jsonb_build_object(
      'inicio', (select ini from params), 'fim', (select fim from params)
    ),
    'aviso', 'Somente leitura; nenhuma linha de negocio alterada. Termina em ROLLBACK.',
    'nota', 'A fonte de verdade do saldo sera decidida pelo usuario apos este rastreio. Nao ha correcao proposta.'
  ),
  'resumo', (select valor from resumo),
  'contas_divergentes', (select valor from contas_divergentes),
  'lancamentos_sem_conta', (select valor from sem_conta),
  'grupos_duplicados', (select valor from duplicados),
  'pagamentos_ambiente_divergente', (select valor from pagamentos_divergentes),
  'parcelas_amountpaid_divergente', (select valor from parcelas_detalhe),
  'previsao_por_status', (select valor from previsao_status),
  'previsao_linhas_afetadas', (select valor from previsao_linhas),
  'previsao_vs_projecao', (select valor from previsao_comparativo)
)) as aprofundamento_fluxo_caixa_20261126;

rollback;

-- Auditoria de Contratos — saída ÚNICA em uma célula
-- 24/11/2026
--
-- Reúne, em uma só consulta:
--   1) os 26 "amountPaid > amount" com pagamentos e transações vinculadas;
--   2) os totais pela fórmula real do trigger;
--   3) os 9 pagamentos sem conta, com candidatos por valor+data.
--
-- Como usar: executar o arquivo inteiro no SQL Editor e copiar a ÚNICA célula
-- `auditoria_contratos_completa`. Não altera nada. Termina em ROLLBACK.

begin;

with pagamentos_por_parcela as (
  select pg.installment_id,
         count(*) as total_pagamentos,
         coalesce(sum(coalesce(pg.amount, 0)), 0) as soma_pagamentos,
         jsonb_agg(jsonb_build_object(
                     'id', pg.id,
                     'type', pg.type,
                     'amount', pg.amount,
                     'payment_date', pg.payment_date,
                     'payment_method', pg.payment_method,
                     'account_id', pg.account_id,
                     'financial_transaction_id', pg.financial_transaction_id,
                     'reverses_payment_id', pg.reverses_payment_id,
                     'description', pg.description
                   ) order by pg.payment_date) as pagamentos
    from public.payments pg
   group by pg.installment_id
),

transacoes_por_parcela as (
  select pg2.installment_id,
         count(ft.id) as total_transacoes,
         coalesce(sum(coalesce(ft.amount, 0))
                    filter (where lower(coalesce(ft.type, '')) = 'income'), 0)
           as soma_transacoes_income,
         coalesce(jsonb_agg(jsonb_build_object(
                              'id', ft.id,
                              'date', ft.date,
                              'amount', ft.amount,
                              'type', ft.type,
                              'account_id', ft.account_id,
                              'category_id', ft.category_id,
                              'description', ft.description
                            ) order by ft.date)
                  filter (where ft.id is not null), '[]'::jsonb) as transacoes
    from public.payments pg2
    left join public.financial_transactions ft on ft.id = pg2.financial_transaction_id
   group by pg2.installment_id
),

base_26 as (
  select i.id as installment_id,
         i.contract_id,
         i.status,
         i.environment,
         i.amount,
         i."amountPaid" as amount_paid,
         i.interest,
         i.fine,
         round((i."amountPaid" - i.amount)::numeric, 2) as excesso,
         round(((i."amountPaid" - i.amount)
                - coalesce(i.interest, 0) - coalesce(i.fine, 0))::numeric, 2) as diferenca,
         p.total_pagamentos,
         p.soma_pagamentos,
         round((coalesce(i."amountPaid", 0) - coalesce(p.soma_pagamentos, 0))::numeric, 2)
           as diferenca_pago_vs_pagamentos,
         t.total_transacoes,
         t.soma_transacoes_income,
         round((coalesce(i."amountPaid", 0) - coalesce(t.soma_transacoes_income, 0))::numeric, 2)
           as diferenca_pago_vs_transacoes,
         p.pagamentos,
         t.transacoes
    from public.installments i
    left join pagamentos_por_parcela p on p.installment_id = i.id
    left join transacoes_por_parcela t on t.installment_id = i.id
   where coalesce(i."amountPaid", 0) > coalesce(i.amount, 0) + 0.01
),

base_totais as (
  select c.id as contract_id,
         c.status,
         c."amountReceivable" as amount_receivable,
         case
           when lower(coalesce(c.status, '')) in ('cancelado', 'cancelada') then 0
           when coalesce(c."isProBono", false) and coalesce(v.v_open, 0) <= 0.01 then 0
           else coalesce(v.v_open, 0)
         end as esperado_trigger,
         c."amountReceivable" -
         case
           when lower(coalesce(c.status, '')) in ('cancelado', 'cancelada') then 0
           when coalesce(c."isProBono", false) and coalesce(v.v_open, 0) <= 0.01 then 0
           else coalesce(v.v_open, 0)
         end as diferenca
    from public.contracts c
    left join (
      select i.contract_id,
             sum(greatest(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0))
               filter (where lower(coalesce(i.status, ''))
                            not in ('quitado', 'cancelado', 'cancelada', 'estornado')) as v_open
        from public.installments i
       group by i.contract_id
    ) v on v.contract_id = c.id
   where abs(c."amountReceivable" - coalesce(c."contractValue", 0)
             + coalesce((select sum(i."amountPaid")
                           from public.installments i
                          where i.contract_id = c.id), 0)) > 0.01
),

base_9 as (
  select p.id as payment_id,
         p.amount,
         p.payment_date,
         i.contract_id,
         p.payment_method,
         p.financial_transaction_id as transaction_id,
         ft.account_id as transaction_account_id,
         (
           select coalesce(jsonb_agg(jsonb_build_object(
                                       'id', q.id,
                                       'date', q.date,
                                       'amount', q.amount,
                                       'type', q.type,
                                       'account_id', q.account_id,
                                       'category_id', q.category_id,
                                       'description', q.description,
                                       'environment', q.environment
                                     ) order by q.id), '[]'::jsonb)
             from (
               select ft2.*
                 from public.financial_transactions ft2
                where ft2.account_id is not null
                  and ft2.date::date = p.payment_date::date
                  and abs(coalesce(ft2.amount, 0) - coalesce(p.amount, 0)) <= 0.01
                  and lower(coalesce(ft2.type, '')) = 'income'
                order by ft2.id desc
                limit 10
             ) q
         ) as candidatas_mesmo_valor_data
    from public.payments p
    left join public.installments i on i.id = p.installment_id
    left join public.financial_transactions ft on ft.id = p.financial_transaction_id
   where lower(coalesce(p.type, '')) = 'payment'
     and p.account_id is null
)

select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),

  'excesso_vs_juros_multa_e_detalhe', (
    select jsonb_build_object(
             'total_candidatos', count(*),
             'explicados_por_juros_multa',
               count(*) filter (where abs(diferenca) <= 0.01),
             'nao_explicados',
               count(*) filter (where abs(diferenca) > 0.01),
             'resumo_pagamentos', (
               select jsonb_build_object(
                        'pago_igual_soma_pagamentos',
                          count(*) filter (where abs(diferenca_pago_vs_pagamentos) <= 0.01),
                        'pago_maior_que_soma_pagamentos',
                          count(*) filter (where diferenca_pago_vs_pagamentos > 0.01),
                        'pago_menor_que_soma_pagamentos',
                          count(*) filter (where diferenca_pago_vs_pagamentos < -0.01),
                        'sem_pagamentos_vinculados',
                          count(*) filter (where coalesce(total_pagamentos, 0) = 0),
                        'com_transacao_vinculada',
                          count(*) filter (where coalesce(total_transacoes, 0) > 0)
                      )
                 from base_26
             ),
             'linhas', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'installment_id', installment_id,
                        'contract_id', contract_id,
                        'status', status,
                        'environment', environment,
                        'amount', amount,
                        'amount_paid', amount_paid,
                        'interest', interest,
                        'fine', fine,
                        'excesso', excesso,
                        'diferenca', diferenca,
                        'total_pagamentos', total_pagamentos,
                        'soma_pagamentos', soma_pagamentos,
                        'diferenca_pago_vs_pagamentos', diferenca_pago_vs_pagamentos,
                        'total_transacoes', total_transacoes,
                        'soma_transacoes_income', soma_transacoes_income,
                        'diferenca_pago_vs_transacoes', diferenca_pago_vs_transacoes,
                        'classificacao', case
                          when coalesce(total_pagamentos, 0) = 0 then 'sem_pagamento_vinculado'
                          when abs(diferenca_pago_vs_pagamentos) <= 0.01 then 'pago_confere_com_pagamentos'
                          when diferenca_pago_vs_pagamentos > 0.01 then 'pago_maior_que_pagamentos'
                          else 'pago_menor_que_pagamentos'
                        end,
                        'pagamentos', pagamentos,
                        'transacoes', transacoes
                      ) order by excesso desc)
                 from base_26
             ), '[]'::jsonb)
           )
      from base_26
  ),

  'totais_formula_trigger', (
    select jsonb_build_object(
             'total_candidatos', count(*),
             'explicados_pela_formula_trigger',
               count(*) filter (where abs(diferenca) <= 0.01),
             'nao_explicados',
               count(*) filter (where abs(diferenca) > 0.01),
             'amostra_nao_explicados', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'contract_id', x.contract_id,
                        'status', x.status,
                        'amount_receivable', x.amount_receivable,
                        'esperado_trigger', x.esperado_trigger,
                        'diferenca', x.diferenca
                      ) order by abs(x.diferenca) desc)
                 from (
                   select *
                     from base_totais
                    where abs(diferenca) > 0.01
                    limit 50
                 ) x
             ), '[]'::jsonb)
           )
      from base_totais
  ),

  'pagamentos_sem_conta', (
    select jsonb_build_object(
             'total', count(*),
             'sem_transacao', count(*) filter (where transaction_id is null),
             'com_conta_na_transacao',
               count(*) filter (where transaction_account_id is not null),
             'sem_conta_na_transacao',
               count(*) filter (where transaction_account_id is null),
             'linhas', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'payment_id', payment_id,
                        'amount', amount,
                        'payment_date', payment_date,
                        'contract_id', contract_id,
                        'payment_method', payment_method,
                        'transaction_id', transaction_id,
                        'transaction_account_id', transaction_account_id,
                        'candidatas_mesmo_valor_data', candidatas_mesmo_valor_data
                      ) order by payment_date desc)
                 from base_9
             ), '[]'::jsonb)
           )
      from base_9
  )
)) as auditoria_contratos_completa;

rollback;

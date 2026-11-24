-- Investigação somente leitura — os 26 "amountPaid > amount"
-- 24/11/2026
--
-- A validação final mostrou que interest=0 e fine=0 nos 26 casos: o excesso
-- NÃO está registrado nessas colunas. Antes de qualquer UPDATE, este script
-- verifica se o excesso corresponde a pagamento/caixa realmente lançado.
--
-- Células: `investigacao_excesso_26` e `candidatos_conta_9`.
-- Não altera nada. Termina em ROLLBACK.

begin;

with base as (
  select i.id as installment_id,
         i.contract_id,
         i.status,
         i.environment,
         i.amount,
         i."amountPaid" as amount_paid,
         i.interest,
         i.fine,
         round((coalesce(i."amountPaid", 0) - coalesce(i.amount, 0))::numeric, 2) as excesso,
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
    left join (
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
    ) p on p.installment_id = i.id
    left join (
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
    ) t on t.installment_id = i.id
   where coalesce(i."amountPaid", 0) > coalesce(i.amount, 0) + 0.01
)
select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'total', (select count(*) from base),
  'resumo', (
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
      from base
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
      from base
  ), '[]'::jsonb)
)) as investigacao_excesso_26;

-- Informativo: candidatos de conta por valor+data para os 9 pagamentos sem conta.
-- NÃO autoriza preenchimento de account_id: é apenas pista de investigação.
select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'total', count(*),
  'linhas', coalesce(jsonb_agg(jsonb_build_object(
    'payment_id', p.id,
    'amount', p.amount,
    'payment_date', p.payment_date,
    'contract_id', i.contract_id,
    'payment_method', p.payment_method,
    'transaction_id', p.financial_transaction_id,
    'transaction_account_id', ft.account_id,
    'candidatas_mesmo_valor_data', (
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
    )
  ) order by p.payment_date desc), '[]'::jsonb)
)) as candidatos_conta_9
from public.payments p
left join public.installments i on i.id = p.installment_id
left join public.financial_transactions ft on ft.id = p.financial_transaction_id
where lower(coalesce(p.type, '')) = 'payment'
  and p.account_id is null;

rollback;

-- Forense somente leitura — Contratos: 26 / 17 / 9 registros
-- 24/11/2026
--
-- Objetivo: decidir se os números do diagnóstico são erros reais ou regra de
-- negócio legítima (juros/multa em amountPaid, fórmula do trigger de total,
-- reversões/pagamentos sem conta). NÃO corrige nada. Termina em ROLLBACK.
--
-- Como usar: executar o arquivo inteiro e copiar a célula `forense_contratos`.

begin;

select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'pg_version', current_setting('server_version'),

  'aviso', 'Registros abaixo são CANDIDATOS a inconsistência. A correção só deve ser escrita depois de comparar com as funções completas e com os pagamentos vinculados.',

  'colunas', (
    select jsonb_object_agg(table_name || '.' || column_name, data_type order by table_name, ordinal_position)
      from information_schema.columns
     where table_schema = 'public'
       and table_name = any(array['payments', 'installments', 'contracts', 'commission_payments', 'financial_transactions'])
  ),

  'funcoes_completas', jsonb_build_object(
    'fn_recalculate_contract_totals', (
      select pg_get_functiondef(p.oid)
        from pg_proc p
       where p.proname = 'fn_recalculate_contract_totals'
       order by p.oid
       limit 1
    ),
    'process_installment_payment_9args', (
      select pg_get_functiondef(p.oid)
        from pg_proc p
       where p.proname = 'process_installment_payment'
         and p.pronargs = 9
       order by p.oid
       limit 1
    ),
    'process_installment_payment_5args', (
      select pg_get_functiondef(p.oid)
        from pg_proc p
       where p.proname = 'process_installment_payment'
         and p.pronargs = 5
       order by p.oid
       limit 1
    ),
    'process_installment_estorno', (
      select pg_get_functiondef(p.oid)
        from pg_proc p
       where p.proname = 'process_installment_estorno'
       order by p.oid
       limit 1
    ),
    'rpc_receber_parcela_com_metodo', (
      select pg_get_functiondef(p.oid)
        from pg_proc p
       where p.proname = 'rpc_receber_parcela_com_metodo'
       order by p.oid
       limit 1
    )
  ),

  'distribuicao_pagamentos', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tipo', coalesce(tipo, 'nulo'),
             'sem_conta', sem_conta,
             'total', total
           ) order by tipo, sem_conta)
      from (
        select lower(coalesce(type, '')) as tipo, account_id is null as sem_conta, count(*) as total
          from public.payments
         group by 1, 2
      ) d
  ), '[]'::jsonb),

  'pagamento_acima_do_valor', jsonb_build_object(
    'total', (
      select count(*) from public.installments
       where coalesce("amountPaid", 0) > coalesce(amount, 0) + 0.01
    ),
    'amostra', coalesce((
      select jsonb_agg(jsonb_build_object(
               'installment_id', i.id,
               'contract_id', i.contract_id,
               'status', i.status,
               'amount', i.amount,
               'amount_paid', i."amountPaid",
               'excesso', round((i."amountPaid" - i.amount)::numeric, 2),
               'pagamentos', (
                 select jsonb_agg(jsonb_build_object(
                          'id', p.id,
                          'type', p.type,
                          'amount', p.amount,
                          'payment_date', p.payment_date,
                          'payment_method', p.payment_method,
                          'account_id', p.account_id,
                          'financial_transaction_id', p.financial_transaction_id,
                          'reverses_payment_id', p.reverses_payment_id
                        ) order by p.payment_date)
                   from public.payments p
                  where p.installment_id = i.id
               )
             ) order by (i."amountPaid" - i.amount) desc)
        from (
          select * from public.installments
           where coalesce("amountPaid", 0) > coalesce(amount, 0) + 0.01
           order by ("amountPaid" - amount) desc
           limit 50
        ) i
    ), '[]'::jsonb)
  ),

  'totais_inconsistentes', jsonb_build_object(
    'total', (
      select count(*)
        from (
          select c.id,
                 abs(coalesce(c."amountReceivable", 0) -
                     greatest(0, coalesce(c."contractValue", 0) -
                       coalesce(sum(i."amountPaid"), 0))) as diff
            from public.contracts c
            left join public.installments i on i.contract_id = c.id
           group by c.id, c."amountReceivable", c."contractValue"
          having abs(coalesce(c."amountReceivable", 0) -
                     greatest(0, coalesce(c."contractValue", 0) -
                       coalesce(sum(i."amountPaid"), 0))) > 0.01
        ) x
    ),
    'amostra', coalesce((
      select jsonb_agg(jsonb_build_object(
               'contract_id', x.id,
               'status', x.status,
               'contract_value', x.contract_value,
               'amount_received', x.amount_received,
               'amount_receivable', x.amount_receivable,
               'soma_pago_parcelas', x.soma_pago,
               'esperado_por_parcelas', x.esperado,
               'diferenca', round(x.diff::numeric, 2),
               'parcelas', x.parcelas,
               'base_comissao', x.base_comissao,
               'commission_percent', x.commission_percent
             ) order by abs(x.diff) desc)
        from (
          select c.id,
                 c.status,
                 c."contractValue" as contract_value,
                 c."amountReceived" as amount_received,
                 c."amountReceivable" as amount_receivable,
                 c.base_comissao,
                 c."commissionPercent" as commission_percent,
                 coalesce(sum(i."amountPaid"), 0) as soma_pago,
                 greatest(0, coalesce(c."contractValue", 0) -
                   coalesce(sum(i."amountPaid"), 0)) as esperado,
                 coalesce(c."amountReceivable", 0) -
                   greatest(0, coalesce(c."contractValue", 0) -
                     coalesce(sum(i."amountPaid"), 0)) as diff,
                 count(i.id) as parcelas
            from public.contracts c
            left join public.installments i on i.contract_id = c.id
           group by c.id, c.status, c."contractValue", c."amountReceived",
                    c."amountReceivable", c.base_comissao, c."commissionPercent"
          having abs(coalesce(c."amountReceivable", 0) -
                     greatest(0, coalesce(c."contractValue", 0) -
                       coalesce(sum(i."amountPaid"), 0))) > 0.01
           order by abs(coalesce(c."amountReceivable", 0) -
                     greatest(0, coalesce(c."contractValue", 0) -
                       coalesce(sum(i."amountPaid"), 0))) desc
           limit 50
        ) x
    ), '[]'::jsonb)
  ),

  'pagamentos_sem_conta', jsonb_build_object(
    'total', (
      select count(*) from public.payments
       where lower(coalesce(type, '')) = 'payment' and account_id is null
    ),
    'amostra', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'installment_id', p.installment_id,
               'contract_id', i.contract_id,
               'amount', p.amount,
               'type', p.type,
               'payment_date', p.payment_date,
               'payment_method', p.payment_method,
               'financial_transaction_id', p.financial_transaction_id,
               'reverses_payment_id', p.reverses_payment_id,
               'user_id', p.user_id,
               'created_by', p.created_by,
               'parcela_status', i.status,
               'parcela_amount', i.amount,
               'parcela_paid', i."amountPaid"
             ) order by p.payment_date desc)
        from public.payments p
        left join public.installments i on i.id = p.installment_id
       where lower(coalesce(p.type, '')) = 'payment' and p.account_id is null
       order by p.payment_date desc
       limit 50
    ), '[]'::jsonb)
  )
)) as forense_contratos;

rollback;

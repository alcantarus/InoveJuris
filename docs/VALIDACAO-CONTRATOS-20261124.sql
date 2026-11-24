-- Validação final somente leitura — Contratos 26 / 17 / 9
-- 24/11/2026
--
-- Confirma se os "candidatos" do diagnóstico são falsos positivos:
--   1) amountPaid > amount é explicado por interest + fine;
--   2) amountReceivable segue a fórmula do trigger v4, não contractValue - sum(amountPaid);
--   3) pagamentos sem conta têm ou não têm conta recuperável na transação vinculada.
-- NÃO altera nada. Termina em ROLLBACK.

begin;

select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),

  'excesso_vs_juros_multa', (
    select jsonb_build_object(
      'total_candidatos', count(*),
      'explicados_por_juros_multa', count(*) filter (where abs(diferenca) <= 0.01),
      'nao_explicados', count(*) filter (where abs(diferenca) > 0.01),
      'amostra_nao_explicados', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'installment_id', a.installment_id,
                 'contract_id', a.contract_id,
                 'amount', a.amount,
                 'amount_paid', a.amount_paid,
                 'excesso', a.excesso,
                 'interest', a.interest,
                 'fine', a.fine,
                 'diferenca', a.diferenca
               ) order by abs(a.diferenca) desc)
          from (
            select x.*
              from (
                select i.id as installment_id,
                       i.contract_id,
                       i.amount,
                       i."amountPaid" as amount_paid,
                       round((i."amountPaid" - i.amount)::numeric, 2) as excesso,
                       i.interest,
                       i.fine,
                       round(((i."amountPaid" - i.amount)
                              - coalesce(i.interest, 0) - coalesce(i.fine, 0))::numeric, 2) as diferenca
                  from public.installments i
                 where coalesce(i."amountPaid", 0) > coalesce(i.amount, 0) + 0.01
              ) x
             where abs(x.diferenca) > 0.01
             limit 50
          ) a
      ), '[]'::jsonb)
    )
      from (
        select ((i."amountPaid" - i.amount)
                - coalesce(i.interest, 0) - coalesce(i.fine, 0)) as diferenca
          from public.installments i
         where coalesce(i."amountPaid", 0) > coalesce(i.amount, 0) + 0.01
      ) d
  ),

  'totais_formula_trigger', (
    select jsonb_build_object(
      'total_candidatos', count(*),
      'explicados_pela_formula_trigger', count(*) filter (where abs(diferenca) <= 0.01),
      'nao_explicados', count(*) filter (where abs(diferenca) > 0.01),
      'amostra_nao_explicados', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'contract_id', b.id,
                 'status', b.status,
                 'amount_receivable', b.amount_receivable,
                 'esperado_trigger', b.esperado,
                 'diferenca', b.diferenca
               ) order by abs(b.diferenca) desc)
          from (
            select y.*
              from (
                select c.id,
                       c.status,
                       c."amountReceivable" as amount_receivable,
                       case
                         when lower(coalesce(c.status, '')) in ('cancelado', 'cancelada') then 0
                         when coalesce(c."isProBono", false)
                              and coalesce(v.v_open, 0) <= 0.01 then 0
                         else coalesce(v.v_open, 0)
                       end as esperado,
                       c."amountReceivable" -
                       case
                         when lower(coalesce(c.status, '')) in ('cancelado', 'cancelada') then 0
                         when coalesce(c."isProBono", false)
                              and coalesce(v.v_open, 0) <= 0.01 then 0
                         else coalesce(v.v_open, 0)
                       end as diferenca
                  from public.contracts c
                  left join (
                    select i.contract_id,
                           sum(greatest(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0))
                             filter (where lower(coalesce(i.status, ''))
                                     not in ('quitado','cancelado','cancelada','estornado')) as v_open
                      from public.installments i
                     group by i.contract_id
                  ) v on v.contract_id = c.id
                 where abs(c."amountReceivable" - coalesce(c."contractValue", 0)
                           + coalesce((select sum(i."amountPaid")
                                         from public.installments i
                                        where i.contract_id = c.id), 0)) > 0.01
              ) y
             where abs(y.diferenca) > 0.01
             limit 50
          ) b
      ), '[]'::jsonb)
    )
      from (
        select c."amountReceivable" -
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
                             not in ('quitado','cancelado','cancelada','estornado')) as v_open
              from public.installments i
             group by i.contract_id
          ) v on v.contract_id = c.id
         where abs(c."amountReceivable" - coalesce(c."contractValue", 0)
                   + coalesce((select sum(i."amountPaid")
                                 from public.installments i
                                where i.contract_id = c.id), 0)) > 0.01
      ) z
  ),

  'pagamentos_sem_conta', (
    select jsonb_build_object(
      'total', count(*),
      'com_conta_na_transacao', count(*) filter (where tx_account is not null),
      'sem_conta_na_transacao', count(*) filter (where tx_account is null),
      'sem_transacao', count(*) filter (where tx_id is null),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'payment_id', a.payment_id,
                 'amount', a.amount,
                 'payment_date', a.payment_date,
                 'contract_id', a.contract_id,
                 'transaction_id', a.transaction_id,
                 'transaction_account_id', a.transaction_account_id,
                 'transaction_type', a.transaction_type,
                 'transaction_amount', a.transaction_amount
               ) order by a.payment_date desc)
          from (
            select p.id as payment_id,
                   p.amount,
                   p.payment_date,
                   i.contract_id,
                   ft.id as transaction_id,
                   ft.account_id as transaction_account_id,
                   ft.type as transaction_type,
                   ft.amount as transaction_amount
              from public.payments p
              left join public.installments i on i.id = p.installment_id
              left join public.financial_transactions ft on ft.id = p.financial_transaction_id
             where lower(coalesce(p.type, '')) = 'payment' and p.account_id is null
             order by p.payment_date desc
             limit 20
          ) a
      ), '[]'::jsonb)
    )
      from (
        select p.financial_transaction_id as tx_id, ft.account_id as tx_account
          from public.payments p
          left join public.financial_transactions ft on ft.id = p.financial_transaction_id
         where lower(coalesce(p.type, '')) = 'payment' and p.account_id is null
      ) p
  )
)) as validacao_contratos;

rollback;

-- ============================================================================
-- INVESTIGA — contrato 138: por que a residual não foi recebida em dinheiro
-- 26/11/2026
--
-- SOMENTE LEITURA. Uma única SELECT, linhas normais, sem JSON.
-- Termina em ROLLBACK.
--
-- A célula anterior mostrou:
--   contrato 138 recebido = 1.500 (esperado 3.000);
--   residual 263 = Aberto, amountPaid = 0;
--   apenas 1 payment (parcial) e 1 transação de caixa.
-- Ou seja: o recebimento da residual NÃO ficou gravado.
--
-- Este script procura o registro perdido em payments/caixa e mostra a auditoria.
-- ============================================================================

begin;

with alvos as (
  select i.id as installment_id, i."installmentNumber" as numero
    from public.installments i
   where i.contract_id = 138
),
estado as (
  select 10::int as ordem,
         'Estado atual'::text as bloco,
         'contracts'::text as origem,
         c.id::text as id,
         'Contrato 138'::text as referencia,
         c."contractValue" as valor,
         c."amountReceived" as pago,
         c.status::text as tipo_acao,
         'a receber=' || c."amountReceivable"::text ||
           '; parcelas declaradas=' || c."installmentsCount"::text as descricao,
         null::text as forma,
         c.created_at::timestamp(0) as quando,
         c.environment::text as ambiente,
         c.organization_id as organization_id,
         'Esperado após o recebimento da residual: pago=3000, a receber=12000' as detalhe
    from public.contracts c
   where c.id = 138

  union all

  select (11 + row_number() over (order by i."installmentNumber"))::int,
         'Estado atual',
         'installments',
         i.id::text,
         'Parcela nº ' || i."installmentNumber"::text,
         i.amount,
         i."amountPaid",
         i.status,
         'vencimento=' || i."dueDate"::text,
         null,
         i.created_at::timestamp(0),
         i.environment,
         i.organization_id,
         case when i."installmentNumber" in (1, 6)
              then 'Foco da investigação' else '' end
    from public.installments i
   where i.contract_id = 138
),
pagtos as (
  select 30::int as ordem,
         'Pagamentos'::text as bloco,
         'payments'::text as origem,
         p.id::text as id,
         coalesce('parcela nº ' || a.numero::text, 'sem parcela') as referencia,
         p.amount as valor,
         p.amount as pago,
         p.type::text as tipo_acao,
         p.description as descricao,
         p.payment_method as forma,
         p.created_at::timestamp(0) as quando,
         p.environment::text as ambiente,
         p.organization_id as organization_id,
         'financial_transaction_id=' || coalesce(p.financial_transaction_id::text, 'null') ||
           '; reverses_payment_id=' || coalesce(p.reverses_payment_id::text, 'null') as detalhe
    from public.payments p
    left join alvos a on a.installment_id = p.installment_id
   where p.installment_id in (select installment_id from alvos)
      or (p.payment_date::date = date '2026-11-26' and p.amount = 1500)
),
caixa as (
  select 50::int as ordem,
         'Caixa'::text as bloco,
         'financial_transactions'::text as origem,
         ft.id::text as id,
         coalesce('conta ' || ft.account_id::text, 'sem conta') as referencia,
         ft.amount as valor,
         ft.amount as pago,
         ft.type::text as tipo_acao,
         ft.description as descricao,
         ft.payment_method as forma,
         ft.created_at::timestamp(0) as quando,
         ft.environment::text as ambiente,
         ft.organization_id as organization_id,
         'date=' || ft.date::text as detalhe
    from public.financial_transactions ft
   where (ft.date = date '2026-11-26' and ft.amount = 1500)
      or ft.id in (
           select p.financial_transaction_id
             from public.payments p
            where p.installment_id in (select installment_id from alvos)
              and p.financial_transaction_id is not null
         )
),
auditoria as (
  select (70 + row_number() over (order by a.performed_at desc))::int as ordem,
         'Auditoria'::text as bloco,
         'audit_logs'::text as origem,
         a.id::text as id,
         a.table_name || ':' || coalesce(a.record_id, '?') as referencia,
         null::numeric as valor,
         null::numeric as pago,
         a.action::text as tipo_acao,
         a.changed_fields::text as descricao,
         null::text as forma,
         a.performed_at::timestamp(0) as quando,
         a.environment::text as ambiente,
         null::uuid as organization_id,
         'status ' || coalesce(a.old_data->>'status', '?') || ' -> ' ||
           coalesce(a.new_data->>'status', '?') ||
           '; amountPaid ' || coalesce(a.old_data->>'amountPaid', '?') || ' -> ' ||
           coalesce(a.new_data->>'amountPaid', '?') as detalhe
    from public.audit_logs a
   where (a.table_name = 'contracts' and a.record_id = '138')
      or (a.table_name = 'installments'
          and a.record_id in (select installment_id::text from alvos))
),
tudo as (
  select * from estado
  union all
  select * from pagtos
  union all
  select * from caixa
  union all
  select * from auditoria
)
select t.ordem, t.bloco, t.origem, t.id, t.referencia, t.valor, t.pago,
       t.tipo_acao, t.descricao, t.forma, t.quando, t.ambiente,
       t.organization_id, t.detalhe
  from tudo t
 order by t.ordem, t.id;

rollback;

-- ============================================================================
-- CADEIA — contrato 138 / Anderson Jose da Silva / homologação (test)
-- 26/11/2026
--
-- SOMENTE LEITURA. Uma única SELECT, sem JSON, sem temp table, sem bloco DO.
-- Termina em ROLLBACK. Funciona no SQL Editor do Supabase.
--
-- Mostra em linhas normais (não JSON):
--   contrato -> 5 parcelas originais -> subparcela residual
--   -> pagamento parcial -> pagamento da residual em dinheiro -> caixa.
--
-- A coluna `org` mostra se organization_id foi preenchido pela rotina
-- (trg_fill_organization_id / zz_tenant_guard_dml) com a org demo de test.
-- A coluna `conferencia` checa os valores informados pelo usuário.
--
-- Observação: `contracts` não tem coluna contractNumber em produção; o "número
-- 138" exibido na tela é o próprio id. Por isso a busca é por c.id = 138.
-- ============================================================================

begin;

with params as (
  select 138::bigint as contract_id,
         'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid as org_teste
),
contrato as (
  select c.id,
         c."contractValue", c."amountReceived", c."amountReceivable",
         c."installmentsCount", c.status, c.environment, c.organization_id,
         c.created_at, cl.name as cliente
    from public.contracts c
    left join public.clients cl on cl.id = c.client_id
    cross join params p
   where c.id = p.contract_id
),
parcelas as (
  select i.id,
         i."installmentNumber", i.amount, i."amountPaid", i.status,
         i."dueDate", i.environment, i.organization_id, i.created_at,
         case
           when i."installmentNumber" between 1 and 5 and i.amount = 3000
             then 'parcela original'
           when i."installmentNumber" > 5 and i.amount = 1500
             then 'subparcela residual'
           else 'outra parcela'
         end as papel
    from public.installments i
    cross join params p
   where i.contract_id = p.contract_id
),
pagamentos as (
  select p.id, p.installment_id, p.amount, p.type, p.payment_date,
         p.payment_method, p.financial_transaction_id, p.environment,
         p.organization_id, p.account_id, p.category_id,
         i.papel, i."installmentNumber" as numero
    from public.payments p
    join parcelas i on i.id = p.installment_id
),
transacoes as (
  select ft.id, ft.date, ft.amount, ft.type, ft.account_id, ft.category_id,
         ft.description, ft.environment, ft.organization_id, ft.created_at
    from public.financial_transactions ft
   where exists (
           select 1 from pagamentos p where p.financial_transaction_id = ft.id
         )
      or exists (
           select 1
             from pagamentos p
            where p.type = 'payment'
              and ft.type = 'income'
              and ft.amount = p.amount
              and ft.date = p.payment_date::date
              and ft.account_id is not distinct from p.account_id
              and ft.category_id is not distinct from p.category_id
              and ft.organization_id is not distinct from p.organization_id
         )
),
linhas as (
  select 10::int as ordem,
         '1. Contrato'::text as etapa,
         'contracts'::text as tabela,
         c.id::text as registro,
         'Contrato ' || c.id::text || ' — ' || coalesce(c.cliente, '(cliente não encontrado)') as detalhe,
         c."contractValue" as valor,
         c."amountReceived" as pago,
         c.status::text as status,
         null::text as forma,
         c.created_at::timestamp(0) as data_evento,
         c.environment::text as environment,
         c.organization_id as organization_id,
         case when c."contractValue" = 15000 and c."installmentsCount" >= 5
              then 'OK — R$ 15.000 em 5 parcelas' else 'DIVERGE' end as conferencia
    from contrato c

  union all

  select (20 + row_number() over (order by i."installmentNumber", i.id))::int,
         case when i.papel = 'subparcela residual'
              then '3. Subparcela residual' else '2. Parcela original' end,
         'installments',
         i.id::text,
         'Parcela nº ' || i."installmentNumber"::text || ' — ' || i.papel ||
           case when i."installmentNumber" = 1 then ' (parcial)' else '' end,
         i.amount,
         i."amountPaid",
         i.status,
         null,
         i.created_at::timestamp(0),
         i.environment,
         i.organization_id,
         case
           when i."installmentNumber" = 1 and i.amount = 3000 and i."amountPaid" = 1500
             then 'OK — 3.000, pago 1.500'
           when i.papel = 'parcela original' and i.amount = 3000
             then 'OK — 3.000'
           when i.papel = 'subparcela residual' and i.amount = 1500 and i."amountPaid" = 1500
             then 'OK — residual 1.500 quitada'
           when i.papel = 'subparcela residual' and i.amount = 1500
             then 'OK — residual 1.500'
           else 'CONFERIR'
         end
    from parcelas i

  union all

  select (40 + row_number() over (order by p.payment_date, p.id))::int,
         case when p.papel = 'subparcela residual'
              then '5. Pagamento da residual' else '4. Pagamento parcial' end,
         'payments',
         p.id::text,
         'Parcela nº ' || p.numero::text || ' — ' || p.papel || ' — ' || p.type,
         p.amount,
         null::numeric,
         p.type,
         p.payment_method,
         p.payment_date::timestamp(0),
         p.environment,
         p.organization_id,
         case when p.type = 'payment' and p.amount = 1500
              then 'OK — R$ 1.500' else 'CONFERIR' end
    from pagamentos p

  union all

  select (60 + row_number() over (order by ft.date, ft.id))::int,
         '6. Caixa',
         'financial_transactions',
         ft.id::text,
         coalesce(ft.description, '(sem descrição)') || ' — ' || ft.type,
         ft.amount,
         null::numeric,
         ft.type,
         null::text,
         ft.date::timestamp(0),
         ft.environment,
         ft.organization_id,
         case when ft.type = 'income' and ft.amount = 1500
              then 'OK — R$ 1.500' else 'CONFERIR' end
    from transacoes ft
)
select l.ordem,
       l.etapa,
       l.tabela,
       l.registro,
       l.detalhe,
       l.valor,
       l.pago,
       l.status || case when l.forma is not null then ' / ' || l.forma else '' end as status_forma,
       l.data_evento as data,
       l.environment as ambiente,
       l.organization_id,
       case
         when l.organization_id is null then 'FALTA'
         when l.organization_id <> p.org_teste then 'OUTRA ORG'
         else 'OK'
       end as org,
       l.conferencia
  from linhas l
  cross join params p
 union all
 select 99::int,
        'RESUMO'::text,
        'totais'::text,
        ''::text,
        'org esperada (test): ' || p.org_teste::text ||
          ' | linhas: ' || count(*)::text ||
          ' | sem organization_id: ' || count(*) filter (where l.organization_id is null)::text,
        null::numeric,
        null::numeric,
        null::text,
        null::timestamp,
        null::text,
        null::uuid,
        case when count(*) filter (
                   where l.organization_id is null or l.organization_id <> p.org_teste
             ) = 0 then 'SUCESSO' else 'FALHA' end,
        null::text
   from linhas l
   cross join params p
 group by p.org_teste
 order by 1;

rollback;

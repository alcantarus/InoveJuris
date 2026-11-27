-- ============================================================================
-- RESIDUAL 263 — conferência do recebimento (contrato 138 / test)
-- 26/11/2026
--
-- SOMENTE LEITURA. Uma única SELECT, sem JSON, sem temp table, sem bloco DO.
-- Termina em ROLLBACK. Roda no SQL Editor do Supabase.
--
-- Como usar:
--   1. rode ANTES do teste  -> o resumo deve dizer PENDENTE;
--   2. receba a parcela 6 na tela;
--   3. rode DEPOIS          -> o resumo deve dizer PASS.
--
-- Sai em linhas normais (máx. ~12 linhas), sem despejar tabelas inteiras.
-- Toda linha mostra o ambiente e a organização; o filtro é explícito em
-- environment = 'test' e na org demo.
-- ============================================================================

begin;

with params as (
  select 138::bigint as contract_id,
         263::bigint as residual_id,
         258::bigint as original_id,
         'cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd'::uuid as org_teste
),
contrato as (
  select c.id, c."contractValue", c."amountReceived", c."amountReceivable",
         c.status, c.environment, c.organization_id
    from public.contracts c
    cross join params p
   where c.id = p.contract_id
     and c.environment = 'test'
     and c.organization_id = p.org_teste
),
residual as (
  select i.id, i."installmentNumber", i.amount, i."amountPaid", i.status,
         i."dueDate", i.environment, i.organization_id
    from public.installments i
    cross join params p
   where i.id = p.residual_id
     and i.environment = 'test'
     and i.organization_id = p.org_teste
),
original as (
  select i.id, i."installmentNumber", i.amount, i."amountPaid", i.status
    from public.installments i
    cross join params p
   where i.id = p.original_id
),
pag_residual as (
  select count(*)::int as qtd,
         coalesce(sum(p.amount), 0)::numeric as total
    from public.payments p
    cross join params x
   where p.installment_id = x.residual_id
     and p.type = 'payment'
),
caixa_residual as (
  select count(*)::int as qtd,
         coalesce(sum(ft.amount), 0)::numeric as total
    from public.financial_transactions ft
    cross join params x
   where ft.id in (
           select p.financial_transaction_id
             from public.payments p
            where p.installment_id = x.residual_id
              and p.financial_transaction_id is not null
         )
),
auditoria as (
  select a.id, a.table_name, a.record_id, a.action,
         a.old_data, a.new_data, a.performed_at, a.environment
    from public.audit_logs a
    cross join params p
   where (a.table_name = 'installments' and a.record_id = p.residual_id::text)
      or (a.table_name = 'contracts' and a.record_id = p.contract_id::text)
   order by a.performed_at desc
   limit 4
),
linhas as (
  select 10::int as ordem,
         '1. Contrato'::text as etapa,
         'contracts'::text as tabela,
         c.id::text as registro,
         'Contrato ' || c.id::text as referencia,
         c."contractValue" as valor,
         c."amountReceived" as pago,
         c.status::text as status,
         null::text as forma,
         'esperado: recebido 3.000 / a receber 12.000'::text as esperado,
         c.environment::text as ambiente,
         c.organization_id,
         case
           when c."amountReceived" = 3000 and c."amountReceivable" = 12000 then 'OK'
           when c."amountReceived" = 1500 and c."amountReceivable" = 13500 then 'PENDENTE'
           else 'FALHA'
         end as situacao
    from contrato c

  union all

  select 20,
         '2. Residual 263',
         'installments',
         r.id::text,
         'Parcela nº ' || r."installmentNumber"::text,
         r.amount,
         r."amountPaid",
         r.status,
         null,
         'esperado: Quitado / pago 1.500',
         r.environment,
         r.organization_id,
         case
           when r.status = 'Quitado' and r."amountPaid" = 1500 then 'OK'
           when r.status = 'Aberto' and r."amountPaid" = 0 then 'PENDENTE'
           else 'FALHA'
         end
    from residual r

  union all

  select 30,
         '3. Original 258',
         'installments',
         o.id::text,
         'Parcela nº ' || o."installmentNumber"::text,
         o.amount,
         o."amountPaid",
         o.status,
         null,
         'esperado: Quitado / pago 1.500 (desdobrada)',
         'test',
         (select org_teste from params),
         case
           when o.status = 'Quitado' and o."amountPaid" = 1500 then 'OK'
           else 'FALHA'
         end
    from original o

  union all

  select 40,
         '4. Payments da residual',
         'payments',
         pr.qtd::text,
         'linhas de pagamento',
         pr.total,
         pr.total,
         'payment',
         null,
         'esperado: 1 linha / 1.500',
         'test',
         (select org_teste from params),
         case when pr.qtd = 1 and pr.total = 1500 then 'OK' else 'PENDENTE' end
    from pag_residual pr

  union all

  select 50,
         '5. Caixa da residual',
         'financial_transactions',
         cr.qtd::text,
         'lançamentos vinculados',
         cr.total,
         cr.total,
         'income',
         null,
         'esperado: 1 linha / 1.500',
         'test',
         (select org_teste from params),
         case when cr.qtd = 1 and cr.total = 1500 then 'OK' else 'PENDENTE' end
    from caixa_residual cr

  union all

  select (60 + row_number() over (order by a.performed_at desc))::int,
         '6. Auditoria',
         'audit_logs',
         a.id::text,
         a.table_name || ':' || coalesce(a.record_id, '?') || ' — ' || a.action,
         null::numeric,
         null::numeric,
         a.action::text,
         null,
         'status ' || coalesce(a.old_data->>'status', '?') || ' -> ' ||
           coalesce(a.new_data->>'status', '?') ||
           ' | pago ' || coalesce(a.old_data->>'amountPaid', '?') || ' -> ' ||
           coalesce(a.new_data->>'amountPaid', '?'),
         a.environment::text,
         (select org_teste from params),
         'INFO'
    from auditoria a
)
select l.ordem,
       l.etapa,
       l.tabela,
       l.registro,
       l.referencia,
       l.valor,
       l.pago,
       l.status || case when l.forma is not null then ' / ' || l.forma else '' end as status_forma,
       l.esperado,
       l.ambiente,
       l.organization_id,
       l.situacao
  from linhas l
 union all
 select 99,
        'RESUMO',
        'resultado',
        '',
        'contrato 138 / residual 263',
        null::numeric,
        null::numeric,
        null::text,
        'PASS = recebimento gravado; PENDENTE = não gravado; FALHA = conferir',
        'test',
        (select org_teste from params),
        case
          when (select count(*) from linhas where situacao = 'FALHA') > 0 then 'FALHA'
          when (select count(*) from linhas where situacao = 'PENDENTE') > 0 then 'PENDENTE'
          else 'PASS'
        end
 order by 1;

rollback;

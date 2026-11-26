-- FORWARD — correção de vw_cash_flow_forecast
-- 26/11/2026
--
-- Autorizado pelo usuario em 26/11/2026: excluir contratos cancelados e
-- calcular parcelas parciais sobre o saldo (amount - amountPaid).
-- NAO excluir Quitado e NAO excluir Estornado (decisao do item 3.2).
--
-- MEDICAO PREVIA (banco unico, environment declarado):
--   diagnostico as 13:25:28 UTC:
--     production 8 linhas / R$ 31.922,64; test 3 linhas / R$ 12.350,00
--   aprofundamento as 13:30:53 UTC:
--     parcela 140 (production, Parcial): 3.000,00 com 2.000,00 pagos,
--       previsto 2.700,00 -> deve passar a 900,00
--     parcela 227 (test, Estornado): 10.000,00, previsto 9.000,00 -> inalterado
--     parcela 238 (test, Cancelada, contrato Cancelado): previsto 1.350,00
--       -> deve sair da view
--   Previsto pos-forward: production R$ 30.122,64 (8->7 linhas);
--     test R$ 11.000,00 (3->2 linhas).
--
-- Efeito esperado: somente a definicao da view. Nenhum dado de negocio alterado.
-- Rollback: docs/ROLLBACK-VW-CASH-FLOW-FORECAST-20261126.sql
-- Verificacao: docs/VERIFY-VW-CASH-FLOW-FORECAST-20261126.sql

begin;

CREATE OR REPLACE VIEW public.vw_cash_flow_forecast AS
SELECT
    i.id AS installment_id,
    i.contract_id,
    i."dueDate" AS due_date,
    i.amount,
    i."amountPaid" AS paid_amount,
    i.status,
    CASE
        WHEN i.status = 'Quitado'::text THEN i.amount
        WHEN lower(btrim(coalesce(i.status, ''))) = 'atrasada'
            THEN GREATEST(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0) * 0.7
        ELSE GREATEST(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0) * 0.9
    END AS expected_amount,
    i.environment
FROM public.installments i
LEFT JOIN public.contracts c ON c.id = i.contract_id
WHERE i."dueDate" >= CURRENT_DATE
  AND i."dueDate" <= (CURRENT_DATE + '30 days'::interval)
  AND lower(btrim(coalesce(c.status, ''))) NOT IN ('cancelado', 'cancelada');

ALTER VIEW public.vw_cash_flow_forecast SET (security_invoker = on);

GRANT SELECT ON public.vw_cash_flow_forecast TO anon, authenticated;

commit;

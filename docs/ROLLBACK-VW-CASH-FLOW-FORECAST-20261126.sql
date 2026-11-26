-- ROLLBACK — correção de vw_cash_flow_forecast
-- 26/11/2026
--
-- REGRA PERMANENTE: banco único; `production` e `test` são valores da coluna
-- `environment`, não bancos separados. Ver
-- docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Desfaz somente
-- docs/FORWARD-VW-CASH-FLOW-FORECAST-20261126.sql, devolvendo a view à
-- definição medida no diagnóstico de 26/11: sem exclusão de cancelados e com
-- o valor cheio nas parciais. Nenhum dado de negócio é alterado.
--
-- A definição abaixo é a vigente antes do forward, registrada no
-- diagnóstico executado às 13:25:28 UTC (PostgreSQL 17.6). `security_invoker`
-- e os grants são preservados, conforme o estado original medido.
--
-- Idempotente: reaplicar não causa erro.
-- Para confirmar, rodar o verify: deve voltar a 8 linhas / R$ 31.922,64 em
-- production e 3 linhas / R$ 12.350,00 em test, com a parcela 140 em
-- R$ 2.700,00 e a parcela 238 presente em R$ 1.350,00.

begin;

CREATE OR REPLACE VIEW public.vw_cash_flow_forecast AS
SELECT
    id AS installment_id,
    contract_id,
    "dueDate" AS due_date,
    amount,
    "amountPaid" AS paid_amount,
    status,
    CASE
        WHEN status = 'Quitado' THEN amount
        WHEN status = 'Atrasada' THEN amount * 0.7
        ELSE amount * 0.9
    END AS expected_amount,
    environment
FROM public.installments
WHERE "dueDate" >= CURRENT_DATE
  AND "dueDate" <= (CURRENT_DATE + '30 days'::interval);

ALTER VIEW public.vw_cash_flow_forecast SET (security_invoker = on);

GRANT SELECT ON public.vw_cash_flow_forecast TO anon, authenticated;

commit;

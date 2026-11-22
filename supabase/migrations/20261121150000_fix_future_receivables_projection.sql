-- B11: projeção de recebimentos futuros deve considerar parcelas prorrogadas
-- e parciais, usar o saldo (amount - amountPaid) e ignorar estornos e
-- contratos cancelados. Mantém a assinatura e o tipo de retorno originais.
--
-- Versão com backup e verificação: docs/CORRECAO-B11-PREVISAO-30-DIAS-20261121.sql

CREATE OR REPLACE FUNCTION public.get_future_receivables_projection(
  p_environment TEXT DEFAULT 'production'
)
RETURNS TABLE (due_month TEXT, total_amount NUMERIC)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(i."dueDate"::date, 'YYYY-MM') AS due_month,
    SUM(GREATEST(COALESCE(i.amount, 0) - COALESCE(i."amountPaid", 0), 0))::numeric AS total_amount
  FROM public.installments i
  LEFT JOIN public.contracts c ON c.id = i.contract_id
  WHERE lower(COALESCE(i.status, '')) IN ('aberto','parcial','atrasada','prorrogada')
    AND lower(COALESCE(c.status, '')) NOT IN ('cancelado','cancelada')
    AND i."dueDate"::date >= CURRENT_DATE
    AND btrim(COALESCE(i.environment, ''), E' \t\r\n') =
        btrim(COALESCE(p_environment, ''), E' \t\r\n')
  GROUP BY to_char(i."dueDate"::date, 'YYYY-MM')
  ORDER BY due_month;
END;
$$;

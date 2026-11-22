-- =============================================================================
-- CORREÇÃO B11 — get_future_receivables_projection
-- Data: 21/11/2026
--
-- Problema confirmado em homologação (21/11/2026):
--   - a função só considerava 'Aberto'/'Atrasada' → ignorava 'Prorrogada'
--     e 'Parcial';
--   - somava o valor bruto (amount) em vez do saldo (amount - amountPaid);
--   - não excluía parcelas estornadas nem de contratos cancelados.
--   - o KPI da tela (app/contas-a-receber/page.tsx) também contava
--     'Estornado': 12.000 exibidos contra 2.000 corretos. Essa parte já foi
--     corrigida no código (filtro IN com os status recebíveis).
--
-- Esta correção NÃO altera dados. Faz backup da definição anterior, troca o
-- corpo da função mantendo assinatura/retorno e termina com UM resultset JSON.
-- =============================================================================

-- 1) Backup da definição anterior e do resultado por ambiente
CREATE TABLE IF NOT EXISTS backup_b11_projecao_20261121 (
  objeto TEXT NOT NULL,
  definicao TEXT,
  capturado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO backup_b11_projecao_20261121 (objeto, definicao)
SELECT 'funcao:get_future_receivables_projection', pg_get_functiondef(p.oid)
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname = 'get_future_receivables_projection';

INSERT INTO backup_b11_projecao_20261121 (objeto, definicao)
SELECT 'resultado_antes:' || e.env,
       COALESCE(
         (SELECT jsonb_object_agg(f.due_month, f.total_amount)::text
          FROM public.get_future_receivables_projection(e.env) f),
         '{}'
       )
FROM (VALUES ('test'::text), ('production'::text)) AS e(env);

-- 2) Pré-validação: a função precisa existir com a assinatura esperada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'get_future_receivables_projection'
      AND pg_get_function_arguments(p.oid) LIKE '%p_environment%'
  ) THEN
    RAISE EXCEPTION 'B11 abortado: get_future_receivables_projection não encontrada com a assinatura esperada.';
  END IF;
END $$;

-- 3) Aplica a correção (mantém p_environment TEXT e RETURNS TABLE(due_month, total_amount))
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

-- 4) Verificação final (último resultset)
WITH ambientes AS (
  SELECT DISTINCT btrim(COALESCE(environment, ''), E' \t\r\n') AS env
  FROM public.installments
  WHERE btrim(COALESCE(environment, ''), E' \t\r\n') IN ('test','production')
),
projecao AS (
  SELECT a.env,
         COALESCE(
           (SELECT jsonb_object_agg(f.due_month, f.total_amount)
            FROM public.get_future_receivables_projection(a.env) f),
           '{}'::jsonb
         ) AS por_mes
  FROM ambientes a
),
previsao30 AS (
  SELECT a.env,
         COUNT(*) AS qtd,
         COALESCE(SUM(GREATEST(COALESCE(i.amount, 0) - COALESCE(i."amountPaid", 0), 0)), 0) AS total
  FROM ambientes a
  JOIN public.installments i
    ON btrim(COALESCE(i.environment, ''), E' \t\r\n') = a.env
  LEFT JOIN public.contracts c ON c.id = i.contract_id
  WHERE lower(COALESCE(i.status, '')) IN ('aberto','parcial','atrasada','prorrogada')
    AND lower(COALESCE(c.status, '')) NOT IN ('cancelado','cancelada')
    AND i."dueDate"::date >= CURRENT_DATE
    AND i."dueDate"::date <= CURRENT_DATE + 30
  GROUP BY a.env
),
funcao AS (
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = 'get_future_receivables_projection'
)
SELECT jsonb_build_object(
  'funcao_definicao', (SELECT def FROM funcao),
  'inclui_prorrogada_e_parcial', (
    SELECT def ILIKE '%prorrogada%' AND def ILIKE '%parcial%' FROM funcao
  ),
  'usa_saldo', (SELECT def ILIKE '%amountPaid%' FROM funcao),
  'status_recebiveis_explicitos_e_sem_estornado', (
    SELECT def ILIKE '%prorrogada%' AND def NOT ILIKE '%estornado%' FROM funcao
  ),
  'filtra_environment', (SELECT def ILIKE '%p_environment%' FROM funcao),
  'projecao_por_mes', (
    SELECT jsonb_object_agg(p.env, p.por_mes) FROM projecao p
  ),
  'previsao_30d_por_ambiente', (
    SELECT jsonb_object_agg(
             p.env,
             jsonb_build_object('qtd', p.qtd, 'total', p.total)
           )
    FROM previsao30 p
  ),
  'objetos_em_backup', (
    SELECT COUNT(*) FROM backup_b11_projecao_20261121
  )
) AS resultado_final;

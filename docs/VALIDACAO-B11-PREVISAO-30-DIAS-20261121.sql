-- =============================================================================
-- VALIDAÇÃO B11 — KPI "Previsão 30 dias"
-- Data: 21/11/2026
-- Somente leitura. Não altera nenhum dado.
--
-- IMPORTANTE: altere o parâmetro `env` abaixo conforme o ambiente que deseja
-- validar. O padrão é 'test' (homologação), onde os testes financeiros foram
-- feitos. Use 'production' apenas para conferência, sem gravar nada.
-- =============================================================================

WITH params AS (
  SELECT 'test'::text AS env   -- <<< 'test' ou 'production'
),
janela AS (
  SELECT
    i.id,
    i.status,
    i.amount,
    i."amountPaid",
    i."dueDate",
    i.contract_id,
    c.status AS contract_status
  FROM public.installments i
  LEFT JOIN public.contracts c ON c.id = i.contract_id
  CROSS JOIN params p
  WHERE btrim(COALESCE(i.environment, ''), E' \t\r\n') = p.env
    AND i."dueDate"::date >= CURRENT_DATE
    AND i."dueDate"::date <= CURRENT_DATE + 30
),
por_status AS (
  SELECT
    COALESCE(i.status, '(nulo)') AS status,
    COUNT(*) AS qtd,
    COALESCE(SUM(GREATEST(COALESCE(i.amount,0) - COALESCE(i."amountPaid",0), 0)), 0) AS saldo
  FROM janela i
  GROUP BY COALESCE(i.status, '(nulo)')
),
-- Regra exata usada hoje pelo front (app/contas-a-receber/page.tsx:378-388)
regra_tela AS (
  SELECT
    COUNT(*) AS qtd,
    COALESCE(SUM(GREATEST(COALESCE(i.amount,0) - COALESCE(i."amountPaid",0), 0)), 0) AS total
  FROM janela i
  WHERE i.status <> 'Quitado'
    AND i.status <> 'Cancelada'
),
-- Regra proposta: só parcelas ainda recebíveis e de contratos não cancelados
regra_correta AS (
  SELECT
    COUNT(*) AS qtd,
    COALESCE(SUM(GREATEST(COALESCE(i.amount,0) - COALESCE(i."amountPaid",0), 0)), 0) AS total
  FROM janela i
  WHERE lower(COALESCE(i.status, '')) IN ('aberto','parcial','atrasada','prorrogada')
    AND lower(COALESCE(i.contract_status, '')) NOT IN ('cancelado','cancelada')
),
-- Regra da função SQL get_future_receivables_projection (somente Aberto/Atrasada, valor bruto)
regra_funcao_atual AS (
  SELECT
    COUNT(*) AS qtd,
    COALESCE(SUM(COALESCE(i.amount, 0)), 0) AS total_bruto
  FROM janela i
  WHERE lower(COALESCE(i.status, '')) IN ('aberto','atrasada')
),
prorrogadas AS (
  SELECT COUNT(*) AS qtd,
         COALESCE(SUM(GREATEST(COALESCE(i.amount,0) - COALESCE(i."amountPaid",0), 0)), 0) AS saldo
  FROM janela i
  WHERE lower(COALESCE(i.status, '')) = 'prorrogada'
),
estornadas AS (
  SELECT COUNT(*) AS qtd,
         COALESCE(SUM(GREATEST(COALESCE(i.amount,0) - COALESCE(i."amountPaid",0), 0)), 0) AS saldo
  FROM janela i
  WHERE lower(COALESCE(i.status, '')) = 'estornado'
),
cancelados_no_periodo AS (
  SELECT c.id AS contrato, c.status AS status_contrato, COUNT(*) AS qtd,
         COALESCE(SUM(GREATEST(COALESCE(i.amount,0) - COALESCE(i."amountPaid",0), 0)), 0) AS saldo
  FROM janela i
  JOIN public.contracts c ON c.id = i.contract_id
  WHERE lower(COALESCE(c.status, '')) IN ('cancelado','cancelada')
  GROUP BY c.id, c.status
),
funcao AS (
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = 'get_future_receivables_projection'
)
SELECT jsonb_build_object(
  'ambiente', (SELECT env FROM params),
  'janela', jsonb_build_object('de', CURRENT_DATE, 'ate', CURRENT_DATE + 30),
  'parcelas_no_periodo', (SELECT COUNT(*) FROM janela),

  'funcao_existe', (SELECT COUNT(*) > 0 FROM funcao),
  'funcao_definicao', (SELECT def FROM funcao),
  'funcao_ignora_prorrogada', (
    SELECT COALESCE(def NOT ILIKE '%prorrogada%', false) FROM funcao
  ),
  'funcao_usa_saldo_em_vez_de_valor_bruto', (
    SELECT COALESCE(def ILIKE '%amountPaid%', false) FROM funcao
  ),

  'por_status', (
    SELECT jsonb_agg(to_jsonb(s) ORDER BY s.status) FROM por_status s
  ),
  'regra_tela', (SELECT to_jsonb(t) FROM regra_tela t),
  'regra_correta', (SELECT to_jsonb(c) FROM regra_correta c),
  'regra_funcao_atual', (SELECT to_jsonb(f) FROM regra_funcao_atual f),
  'diferenca_tela_menos_correta', (
    SELECT t.total - c.total FROM regra_tela t CROSS JOIN regra_correta c
  ),
  'parcelas_prorrogadas_no_periodo', (SELECT to_jsonb(p) FROM prorrogadas p),
  'parcelas_estornadas_no_periodo', (SELECT to_jsonb(e) FROM estornadas e),
  'contratos_cancelados_no_periodo', (
    SELECT jsonb_agg(to_jsonb(c) ORDER BY c.contrato) FROM cancelados_no_periodo c
  )
) AS resultado_validacao;

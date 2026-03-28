-- ==============================================================================
-- FASE 1: ATUALIZAÇÃO DO BANCO DE DADOS (CONTAS A RECEBER E DASHBOARD)
-- ==============================================================================

-- 1. Tabela de Auditoria (Timeline de Parcelas)
CREATE TABLE IF NOT EXISTS installment_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    installment_id bigint REFERENCES installments(id) ON DELETE CASCADE,
    action varchar(50) NOT NULL, -- 'Criada', 'Prorrogada', 'Pagamento Parcial', 'Quitada', 'Estornada', 'Cancelada'
    previous_state jsonb,
    new_state jsonb,
    user_id uuid REFERENCES auth.users(id),
    environment varchar(50) DEFAULT 'production',
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE installment_history ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para installment_history
CREATE POLICY "Users can view installment history in their environment"
    ON installment_history FOR SELECT
    USING (environment = current_setting('app.current_env', true));

CREATE POLICY "Users can insert installment history in their environment"
    ON installment_history FOR INSERT
    WITH CHECK (environment = current_setting('app.current_env', true));

-- 2. View Materializada / View normal para Dashboard (Métricas de Recebíveis)
-- Usaremos uma View normal para garantir dados em tempo real sem precisar de refresh manual.
CREATE OR REPLACE VIEW vw_dashboard_receivables_metrics AS
SELECT 
    environment,
    COUNT(id) as total_installments,
    SUM(amount) as total_expected,
    SUM(COALESCE("amountPaid", 0)) as total_received,
    SUM(amount - COALESCE("amountPaid", 0)) as total_pending,
    -- Vencidos (Atrasados)
    SUM(CASE WHEN "dueDate" < CURRENT_DATE AND status NOT IN ('Quitado', 'Cancelada') THEN amount - COALESCE("amountPaid", 0) ELSE 0 END) as total_overdue,
    COUNT(CASE WHEN "dueDate" < CURRENT_DATE AND status NOT IN ('Quitado', 'Cancelada') THEN 1 END) as count_overdue,
    -- Vence Hoje
    SUM(CASE WHEN "dueDate" = CURRENT_DATE AND status NOT IN ('Quitado', 'Cancelada') THEN amount - COALESCE("amountPaid", 0) ELSE 0 END) as total_due_today,
    COUNT(CASE WHEN "dueDate" = CURRENT_DATE AND status NOT IN ('Quitado', 'Cancelada') THEN 1 END) as count_due_today,
    -- A Vencer (Próximos 15 dias)
    SUM(CASE WHEN "dueDate" > CURRENT_DATE AND "dueDate" <= CURRENT_DATE + INTERVAL '15 days' AND status NOT IN ('Quitado', 'Cancelada') THEN amount - COALESCE("amountPaid", 0) ELSE 0 END) as total_due_15_days
FROM installments
GROUP BY environment;

-- 3. View para Previsão de Entrada (Próximos 15 dias)
CREATE OR REPLACE VIEW vw_dashboard_receivables_forecast AS
SELECT 
    environment,
    "dueDate" as due_date,
    SUM(amount - COALESCE("amountPaid", 0)) as expected_amount
FROM installments
WHERE "dueDate" >= CURRENT_DATE 
  AND "dueDate" <= CURRENT_DATE + INTERVAL '15 days'
  AND status NOT IN ('Quitado', 'Cancelada')
GROUP BY environment, "dueDate"
ORDER BY "dueDate" ASC;

-- 4. View para Top 5 Clientes Inadimplentes
CREATE OR REPLACE VIEW vw_dashboard_top_defaulters AS
SELECT 
    i.environment,
    c.client_id,
    cl.name as client_name,
    SUM(i.amount - COALESCE(i."amountPaid", 0)) as total_overdue_amount,
    COUNT(i.id) as overdue_installments_count
FROM installments i
JOIN contracts c ON i.contract_id = c.id
JOIN clients cl ON c.client_id = cl.id
WHERE i."dueDate" < CURRENT_DATE 
  AND i.status NOT IN ('Quitado', 'Cancelada')
GROUP BY i.environment, c.client_id, cl.name
ORDER BY total_overdue_amount DESC;

-- Atualizar o cache do PostgREST
NOTIFY pgrst, 'reload config';

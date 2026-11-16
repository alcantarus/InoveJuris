-- 1. Adicionar coluna alert_sent na tabela process_deadlines
ALTER TABLE process_deadlines ADD COLUMN IF NOT EXISTS alert_sent BOOLEAN DEFAULT FALSE;

-- 2. Atualizar ou criar a view process_deadlines_view para unificar prazos
DROP VIEW IF EXISTS process_deadlines_view;
CREATE VIEW process_deadlines_view AS
SELECT 
    p.id AS process_id,
    p.number AS process_number,
    p.client AS client_name,
    p.deadline_date AS deadline_date,
    'Prazo Principal' AS description,
    'Pendente' AS status,
    p.status AS process_status
FROM processes p
WHERE p.deadline_date IS NOT NULL
UNION ALL
SELECT 
    pd.process_id,
    p.number AS process_number,
    p.client AS client_name,
    pd.deadline_date AS deadline_date,
    pd.description AS description,
    pd.status AS status,
    p.status AS process_status
FROM process_deadlines pd
JOIN processes p ON pd.process_id = p.id;

-- 1. Create view vw_process_velocity
DROP VIEW IF EXISTS vw_process_velocity;
CREATE VIEW vw_process_velocity AS
SELECT
    id AS contract_id,
    client_id,
    "lawArea" AS law_area,
    created_at,
    "last_update" AS last_update,
    EXTRACT(DAY FROM (NOW() - "last_update"::TIMESTAMPTZ)) AS days_since_last_movement
FROM
    contracts
WHERE
    status NOT IN ('Quitado', 'Arquivado');

-- 2. Create view vw_cash_flow_forecast
DROP VIEW IF EXISTS vw_cash_flow_forecast;
CREATE VIEW vw_cash_flow_forecast AS
SELECT
    id AS installment_id,
    contract_id,
    due_date,
    amount,
    paid_amount,
    status,
    CASE
        WHEN status = 'Paga' THEN amount
        WHEN status = 'Atrasada' THEN amount * 0.7 -- Probabilidade de recebimento de 70% para atrasados
        ELSE amount * 0.9 -- Probabilidade de recebimento de 90% para previstos
    END AS expected_amount
FROM
    installments
WHERE
    due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days');

-- 3. Create view vw_area_efficiency
DROP VIEW IF EXISTS vw_area_efficiency;
CREATE VIEW vw_area_efficiency AS
SELECT
    "lawArea" AS law_area,
    COUNT(id) AS total_processes,
    AVG(contract_value) AS average_ticket
FROM
    contracts
GROUP BY
    "lawArea";

-- Grant select on views to public
GRANT SELECT ON vw_process_velocity TO anon, authenticated;
GRANT SELECT ON vw_cash_flow_forecast TO anon, authenticated;
GRANT SELECT ON vw_area_efficiency TO anon, authenticated;

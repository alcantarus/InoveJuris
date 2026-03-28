-- ==============================================================================
-- CORREÇÃO DO RADAR DE PRAZOS E VINCULAÇÃO DE CLIENTES
-- ==============================================================================

-- 1. Atualizar a View para buscar o nome do cliente real via Contrato, se existir
-- Isso garante que se o processo estiver vinculado a um contrato, o nome do cliente
-- virá da tabela 'clients', corrigindo discrepâncias como o nome "Anderson".
CREATE OR REPLACE VIEW public.process_deadlines_view AS
SELECT 
    pd.id,
    pd.process_id,
    p.number as process_number,
    -- Prioriza o nome do cliente vinculado via contrato, senão usa o campo texto do processo
    COALESCE(cl.name, p.client) as client_name,
    pd.deadline_date,
    pd.description,
    pd.status,
    pd.environment,
    (pd.deadline_date - CURRENT_DATE) as days_remaining
FROM public.process_deadlines pd
JOIN public.processes p ON pd.process_id = p.id
LEFT JOIN public.contracts c ON (p.number = c."processNumber" AND p.environment = c.environment)
LEFT JOIN public.clients cl ON c.client_id = cl.id
WHERE pd.status != 'Concluído';

-- 2. Tentar corrigir o dado diretamente na tabela 'processes' para o processo específico
-- se conseguirmos encontrar o cliente vinculado via contrato.
DO $$
DECLARE
    v_client_name TEXT;
    v_process_number TEXT := '1010400-02.2025.4.01.3303';
BEGIN
    -- Busca o nome do cliente vinculado ao contrato deste processo
    SELECT cl.name INTO v_client_name
    FROM public.contracts c
    JOIN public.clients cl ON c.client_id = cl.id
    WHERE c."processNumber" = v_process_number
    LIMIT 1;

    -- Se encontrou um cliente diferente de 'Anderson', atualiza a tabela processes
    IF v_client_name IS NOT NULL AND v_client_name != 'Anderson' THEN
        UPDATE public.processes 
        SET client = v_client_name 
        WHERE number = v_process_number;
    END IF;
END $$;

-- 3. Recarregar o cache do PostGrest
NOTIFY pgrst, 'reload schema';

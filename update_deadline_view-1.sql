-- ==============================================================================
-- ATUALIZAÇÃO DO RADAR DE PRAZOS (VERSÃO INTELIGENTE)
-- ==============================================================================

-- 1. Atualizar a View para incluir o tipo de processo e garantir ordenação correta
DROP VIEW IF EXISTS public.process_deadlines_view;
CREATE VIEW public.process_deadlines_view AS
SELECT 
    pd.id,
    pd.process_id,
    p.number as process_number,
    p.type as process_type, -- Adicionado para distinguir Judicial/Previdenciário
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

-- 2. Recarregar o cache do PostGrest
NOTIFY pgrst, 'reload schema';

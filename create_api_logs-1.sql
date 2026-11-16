-- ==============================================================================
-- FASE 1: OBSERVABILIDADE - CRIAÇÃO DA TABELA DE LOGS DE INTEGRAÇÕES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS integration_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    service_name TEXT NOT NULL,              -- Ex: 'datajud', 'previdenciario'
    endpoint TEXT NOT NULL,                  -- Ex: '/v1/search'
    context_id UUID,                         -- Referência genérica (pode ser process_id, client_id, etc.)
    status_code INTEGER,                     -- Ex: 200, 404, 500
    request_payload JSONB,                   -- O que enviamos
    response_body JSONB,                     -- O que recebemos
    error_message TEXT,                      -- Se falhou, por quê?
    attempt_number INTEGER DEFAULT 1         -- Para controle de retry
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_integration_logs_service_name ON integration_logs(service_name);
CREATE INDEX IF NOT EXISTS idx_integration_logs_context_id ON integration_logs(context_id);

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';

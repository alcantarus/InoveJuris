-- Enriquece o módulo de Processos com os campos dos modelos 05-processos.md e 06-processo.md.
-- Idempotente: pode ser executado quantas vezes for necessário.

-- Dados cadastrais do processo (detalhe)
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS phase TEXT;
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS comarca TEXT;
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS tribunal TEXT;
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS distribution_date DATE;
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Manual';
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS parties JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS secret_justice BOOLEAN DEFAULT FALSE;

-- Memória e confirmação dos prazos exibidos no detalhe do processo
ALTER TABLE public.process_deadlines ADD COLUMN IF NOT EXISTS notification_date DATE;
ALTER TABLE public.process_deadlines ADD COLUMN IF NOT EXISTS publication_date DATE;
ALTER TABLE public.process_deadlines ADD COLUMN IF NOT EXISTS count_start_date DATE;
ALTER TABLE public.process_deadlines ADD COLUMN IF NOT EXISTS business_days INTEGER;
ALTER TABLE public.process_deadlines ADD COLUMN IF NOT EXISTS calculation_memory TEXT;
ALTER TABLE public.process_deadlines ADD COLUMN IF NOT EXISTS responsible_id BIGINT REFERENCES public.lawyers(id) ON DELETE SET NULL;
ALTER TABLE public.process_deadlines ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.process_deadlines ADD COLUMN IF NOT EXISTS confirmed_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.process_deadlines ADD COLUMN IF NOT EXISTS justification TEXT;

COMMENT ON COLUMN public.processes.phase IS 'Fase processual ex.: Instrução, Conhecimento, Execução';
COMMENT ON COLUMN public.processes.parties IS 'Partes no formato [{name, role, type}]';
COMMENT ON COLUMN public.processes.source IS 'Origem do cadastro: Manual, DataJud, DJEN';
COMMENT ON COLUMN public.process_deadlines.calculation_memory IS 'Memória determinística do cálculo do prazo';

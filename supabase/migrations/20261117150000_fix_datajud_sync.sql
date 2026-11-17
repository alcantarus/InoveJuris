-- Corrige a integração DataJud:
-- 1) process_sync_status não tinha a coluna environment usada pelo dashboard (erro 42703).
-- 2) last_update era gravado como o texto 'Agora', quebrando vw_process_velocity.

ALTER TABLE public.process_sync_status
  ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production';

UPDATE public.process_sync_status
  SET environment = 'production'
  WHERE environment IS NULL;

UPDATE public.processes
  SET last_update = CASE
    WHEN updated_at IS NOT NULL THEN updated_at::TEXT
    ELSE NULL
  END
  WHERE last_update = 'Agora';

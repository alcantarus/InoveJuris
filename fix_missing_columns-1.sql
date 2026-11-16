-- ==============================================================================
-- SCRIPT DE CORREÇÃO DE COLUNAS FALTANTES
-- ==============================================================================

-- 1. Adicionar created_at em birthday_messages se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_messages' AND column_name = 'created_at') THEN
        ALTER TABLE birthday_messages ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 2. Adicionar created_at em birthday_templates se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'created_at') THEN
        ALTER TABLE birthday_templates ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 3. Adicionar created_at em marketing_logs se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_logs' AND column_name = 'created_at') THEN
        ALTER TABLE marketing_logs ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 4. Garantir outras colunas essenciais em birthday_templates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'environment') THEN
        ALTER TABLE birthday_templates ADD COLUMN environment TEXT DEFAULT 'production';
    END IF;
END $$;

-- 5. Garantir outras colunas essenciais em birthday_messages
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_messages' AND column_name = 'environment') THEN
        ALTER TABLE birthday_messages ADD COLUMN environment TEXT DEFAULT 'production';
    END IF;
END $$;

-- 6. Notificar o PostgREST para recarregar o cache de schema
NOTIFY pgrst, 'reload config';

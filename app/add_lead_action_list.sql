-- Add Action List columns to leads table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'next_action_date') THEN
        ALTER TABLE leads ADD COLUMN next_action_date TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'next_action_type') THEN
        ALTER TABLE leads ADD COLUMN next_action_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'score') THEN
        ALTER TABLE leads ADD COLUMN score TEXT DEFAULT '❄️ Frio';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'funnel_stage') THEN
        ALTER TABLE leads ADD COLUMN funnel_stage TEXT DEFAULT 'Contato';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'ai_notes') THEN
        ALTER TABLE leads ADD COLUMN ai_notes TEXT;
    END IF;
END $$;

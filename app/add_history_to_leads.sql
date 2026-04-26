DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'history') THEN
        ALTER TABLE leads ADD COLUMN history JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

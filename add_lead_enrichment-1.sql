DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'indicator_id') THEN
        ALTER TABLE leads ADD COLUMN indicator_id INTEGER REFERENCES indicators(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'prospecting_source') THEN
        ALTER TABLE leads ADD COLUMN prospecting_source TEXT;
    END IF;
END
$$;

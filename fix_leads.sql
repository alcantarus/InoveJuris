DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
    ALTER TABLE leads ALTER COLUMN status TYPE TEXT USING status::text;
    DROP TYPE lead_status;
  END IF;
END $$;

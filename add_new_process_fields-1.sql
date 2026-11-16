DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processes' AND column_name = 'risk_assessment') THEN
      ALTER TABLE processes ADD COLUMN risk_assessment TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processes' AND column_name = 'tags') THEN
      ALTER TABLE processes ADD COLUMN tags TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processes' AND column_name = 'case_value') THEN
      ALTER TABLE processes ADD COLUMN case_value DECIMAL(12, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processes' AND column_name = 'internal_notes') THEN
      ALTER TABLE processes ADD COLUMN internal_notes TEXT;
  END IF;
END;
$$;

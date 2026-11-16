-- Add CRM features to clients table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'tags') THEN
      ALTER TABLE clients ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'last_contact_at') THEN
      ALTER TABLE clients ADD COLUMN last_contact_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'next_follow_up_at') THEN
      ALTER TABLE clients ADD COLUMN next_follow_up_at TIMESTAMP WITH TIME ZONE;
  END IF;
END;
$$;

-- Fix birthday_templates ID type to be UUID and ensure font columns exist
DO $$
BEGIN
    -- 1. Ensure font columns exist (just in case previous fix wasn't run)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'msg_font') THEN
        ALTER TABLE birthday_templates ADD COLUMN msg_font TEXT DEFAULT 'sans-serif';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'name_font') THEN
        ALTER TABLE birthday_templates ADD COLUMN name_font TEXT DEFAULT 'sans-serif';
    END IF;

    -- 2. Convert ID from BIGINT to UUID if necessary
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'birthday_templates' 
        AND column_name = 'id' 
        AND data_type = 'bigint'
    ) THEN
        -- Drop the default value (sequence)
        ALTER TABLE birthday_templates ALTER COLUMN id DROP DEFAULT;
        
        -- Change the column type to UUID, generating new UUIDs for existing rows
        -- Using gen_random_uuid() which is built-in in Postgres 13+
        ALTER TABLE birthday_templates ALTER COLUMN id TYPE UUID USING gen_random_uuid();
        
        -- Set the new default to generate UUIDs
        ALTER TABLE birthday_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload config';

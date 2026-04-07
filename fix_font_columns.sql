-- Fix missing font columns in birthday_templates table
DO $$
BEGIN
    -- msg_font
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'msg_font') THEN
        ALTER TABLE birthday_templates ADD COLUMN msg_font TEXT DEFAULT 'sans-serif';
    END IF;

    -- name_font
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'name_font') THEN
        ALTER TABLE birthday_templates ADD COLUMN name_font TEXT DEFAULT 'sans-serif';
    END IF;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload config';

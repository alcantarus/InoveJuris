-- Fix missing columns in birthday_templates table
-- This script adds columns that might be missing if the table was created with an older schema

DO $$
BEGIN
    -- line_height
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'line_height') THEN
        ALTER TABLE birthday_templates ADD COLUMN line_height TEXT DEFAULT '1.2';
    END IF;

    -- text_align
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'text_align') THEN
        ALTER TABLE birthday_templates ADD COLUMN text_align TEXT DEFAULT 'center';
    END IF;

    -- name_max_width
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'name_max_width') THEN
        ALTER TABLE birthday_templates ADD COLUMN name_max_width TEXT DEFAULT '80%';
    END IF;

    -- msg_max_width
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'msg_max_width') THEN
        ALTER TABLE birthday_templates ADD COLUMN msg_max_width TEXT DEFAULT '80%';
    END IF;

    -- photo_shape
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'photo_shape') THEN
        ALTER TABLE birthday_templates ADD COLUMN photo_shape TEXT DEFAULT 'circle';
    END IF;

    -- show_client_photo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'show_client_photo') THEN
        ALTER TABLE birthday_templates ADD COLUMN show_client_photo BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Notify PostgREST to reload schema cache to pick up new columns immediately
NOTIFY pgrst, 'reload config';

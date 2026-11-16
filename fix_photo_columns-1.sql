-- Fix missing photo columns in birthday_templates table
-- This script adds columns related to photo positioning and sizing

DO $$
BEGIN
    -- photo_size
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'photo_size') THEN
        ALTER TABLE birthday_templates ADD COLUMN photo_size TEXT DEFAULT '80px';
    END IF;

    -- photo_x
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'photo_x') THEN
        ALTER TABLE birthday_templates ADD COLUMN photo_x TEXT DEFAULT '50%';
    END IF;

    -- photo_y
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'photo_y') THEN
        ALTER TABLE birthday_templates ADD COLUMN photo_y TEXT DEFAULT '20%';
    END IF;

    -- Ensure other potentially missing columns are present
    
    -- msg_x
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'msg_x') THEN
        ALTER TABLE birthday_templates ADD COLUMN msg_x TEXT DEFAULT '50%';
    END IF;

    -- msg_y
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'msg_y') THEN
        ALTER TABLE birthday_templates ADD COLUMN msg_y TEXT DEFAULT '60%';
    END IF;

    -- msg_size
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'msg_size') THEN
        ALTER TABLE birthday_templates ADD COLUMN msg_size TEXT DEFAULT '14px';
    END IF;

    -- name_x
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'name_x') THEN
        ALTER TABLE birthday_templates ADD COLUMN name_x TEXT DEFAULT '50%';
    END IF;

    -- name_y
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'name_y') THEN
        ALTER TABLE birthday_templates ADD COLUMN name_y TEXT DEFAULT '40%';
    END IF;

    -- name_size
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'birthday_templates' AND column_name = 'name_size') THEN
        ALTER TABLE birthday_templates ADD COLUMN name_size TEXT DEFAULT '36px';
    END IF;

END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload config';

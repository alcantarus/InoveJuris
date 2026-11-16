-- Add photo_url column to clients table if it doesn't exist
ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Update existing clients to have a null photo_url if they don't have one
UPDATE clients SET photo_url = NULL WHERE photo_url IS NULL;

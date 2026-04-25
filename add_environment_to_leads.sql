ALTER TABLE leads ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production';
ALTER TABLE leads ALTER COLUMN environment SET DEFAULT 'production';
UPDATE leads SET environment = 'production' WHERE environment IS NULL;

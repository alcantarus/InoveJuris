ALTER TABLE leads ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production';
create index if not exists idx_leads_environment on leads(environment);

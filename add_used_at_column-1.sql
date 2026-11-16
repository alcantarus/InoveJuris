ALTER TABLE client_onboarding_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

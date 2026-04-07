-- Tabela trusted_devices
CREATE TABLE IF NOT EXISTS public.trusted_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    ip_address TEXT,
    location TEXT,
    trusted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    environment TEXT DEFAULT 'production'
);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access for trusted_devices" ON public.trusted_devices;
CREATE POLICY "Public access for trusted_devices" ON public.trusted_devices FOR ALL USING (true);

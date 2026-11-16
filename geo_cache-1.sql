-- Tabela para cache de GeoIP
CREATE TABLE IF NOT EXISTS public.geo_cache (
    ip TEXT PRIMARY KEY,
    location TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.geo_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access for geo_cache" ON public.geo_cache;
CREATE POLICY "Public access for geo_cache" ON public.geo_cache FOR ALL USING (true);

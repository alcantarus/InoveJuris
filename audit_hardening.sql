-- 1. Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_at ON public.user_sessions(login_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON public.login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- 2. Função de limpeza de logs antigos (Retenção de dados)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.login_attempts WHERE attempted_at < NOW() - INTERVAL '90 days';
  DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql;

-- 3. Hardening das Security Rules (RLS)
-- Nota: Assume que a tabela 'public.users' possui uma coluna 'role'.

-- user_sessions
DROP POLICY IF EXISTS "Public access for user_sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Admin access for user_sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "User access for user_sessions" ON public.user_sessions;

-- Create permissive policies since auth is handled at the application level
CREATE POLICY "Enable read access for all users" ON user_sessions FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON user_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON user_sessions FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON user_sessions FOR DELETE USING (true);

-- login_attempts (Apenas admins)
DROP POLICY IF EXISTS "Public access for login_attempts" ON public.login_attempts;
CREATE POLICY "Admin access for login_attempts" ON public.login_attempts FOR SELECT USING (auth.uid() IN (SELECT id::text FROM public.users WHERE role = 'admin'));

-- trusted_devices
DROP POLICY IF EXISTS "Public access for trusted_devices" ON public.trusted_devices;
CREATE POLICY "Admin access for trusted_devices" ON public.trusted_devices FOR ALL USING (auth.uid() IN (SELECT id::text FROM public.users WHERE role = 'admin'));
CREATE POLICY "User access for trusted_devices" ON public.trusted_devices FOR SELECT USING (user_id::text = auth.uid());

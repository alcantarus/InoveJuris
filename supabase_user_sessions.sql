CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logout_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    location TEXT,
    environment TEXT NOT NULL DEFAULT 'production'
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON user_sessions;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON user_sessions;
CREATE POLICY "Enable read access for all users" ON user_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON user_sessions;
DROP POLICY IF EXISTS "Enable insert for all users" ON user_sessions;
CREATE POLICY "Enable insert for all users" ON user_sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON user_sessions;
DROP POLICY IF EXISTS "Enable update for all users" ON user_sessions;
CREATE POLICY "Enable update for all users" ON user_sessions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON user_sessions;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON user_sessions;
CREATE POLICY "Enable delete for all users" ON user_sessions FOR DELETE USING (true);

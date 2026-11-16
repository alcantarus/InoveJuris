-- Fix RLS policies for user_sessions to work with custom auth

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON user_sessions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON user_sessions;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON user_sessions;
DROP POLICY IF EXISTS "Admin access for user_sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "User access for user_sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Public access for user_sessions" ON public.user_sessions;

-- Create permissive policies since auth is handled at the application level
CREATE POLICY "Enable read access for all users" ON user_sessions FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON user_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON user_sessions FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON user_sessions FOR DELETE USING (true);

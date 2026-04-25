-- Enable RLS on leads table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users if they match the environment
DROP POLICY IF EXISTS "Allow authenticated access to leads" ON leads;
CREATE POLICY "Allow authenticated access to leads" ON leads
    FOR ALL
    TO authenticated
    USING (environment = current_setting('app.current_env', true))
    WITH CHECK (environment = current_setting('app.current_env', true));

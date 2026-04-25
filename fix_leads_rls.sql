-- Enable RLS on leads table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
DROP POLICY IF EXISTS "Allow authenticated access to leads" ON leads;
CREATE POLICY "Allow authenticated access to leads" ON leads
    FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

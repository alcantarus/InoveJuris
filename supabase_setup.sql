-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1.5 Add data_nascimento to indicators table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'indicators' AND column_name = 'data_nascimento') THEN
      ALTER TABLE indicators ADD COLUMN data_nascimento DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'environment') THEN
      ALTER TABLE contracts ADD COLUMN environment TEXT DEFAULT 'production';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'environment') THEN
      ALTER TABLE clients ADD COLUMN environment TEXT DEFAULT 'production';
  END IF;

  -- Add 'type' column to payments if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'type') THEN
        ALTER TABLE payments ADD COLUMN type TEXT DEFAULT 'payment';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'created_by') THEN
        ALTER TABLE payments ADD COLUMN created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END;
$$;

-- 2. Create commission_payments table
CREATE TABLE IF NOT EXISTS commission_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    contract_id BIGINT REFERENCES contracts(id) ON DELETE CASCADE,
    indicator_id BIGINT REFERENCES indicators(id) ON DELETE CASCADE,
    amount_paid DECIMAL(12, 2) NOT NULL,
    payment_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    environment TEXT DEFAULT 'production',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add environment column to commission_payments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commission_payments' AND column_name = 'environment') THEN
      ALTER TABLE commission_payments ADD COLUMN environment TEXT DEFAULT 'production';
  END IF;
END;
$$;

-- 3. Create indicator_tokens table
CREATE TABLE IF NOT EXISTS indicator_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    indicator_id BIGINT REFERENCES indicators(id),
    token TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    environment TEXT DEFAULT 'production',
    type TEXT DEFAULT 'fixed',
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Remove the unique constraint on indicator_id if it exists (from previous versions)
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'indicator_tokens' AND ccu.column_name = 'indicator_id' AND tc.constraint_type = 'UNIQUE';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE indicator_tokens DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Add environment column to indicator_tokens if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'indicator_tokens' AND column_name = 'environment') THEN
      ALTER TABLE indicator_tokens ADD COLUMN environment TEXT DEFAULT 'production';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'indicator_tokens' AND column_name = 'type') THEN
      ALTER TABLE indicator_tokens ADD COLUMN type TEXT DEFAULT 'fixed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'indicator_tokens' AND column_name = 'expires_at') THEN
      ALTER TABLE indicator_tokens ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'indicator_tokens' AND column_name = 'is_active') THEN
      ALTER TABLE indicator_tokens ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END;
$$;

-- 4. Enable RLS
ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicator_tokens ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Allow authenticated users to manage commission_payments' 
        AND tablename = 'commission_payments'
    ) THEN
        CREATE POLICY "Allow authenticated users to manage commission_payments" ON commission_payments
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Allow public read of indicator_tokens' 
        AND tablename = 'indicator_tokens'
    ) THEN
        CREATE POLICY "Allow public read of indicator_tokens" ON indicator_tokens
            FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Allow all users to insert indicator_tokens' 
        AND tablename = 'indicator_tokens'
    ) THEN
        CREATE POLICY "Allow all users to insert indicator_tokens" ON indicator_tokens
            FOR INSERT WITH CHECK (true);
    END IF;
END;
$$;

-- 6. Create view vw_indicator_commission_status
DROP VIEW IF EXISTS vw_indicator_commission_status;
CREATE VIEW vw_indicator_commission_status AS
SELECT
    c.id AS contract_id,
    c.indicator_id,
    i.name AS indicator_name,
    cl.name AS client_name,
    c.environment,
    (c.base_comissao * (c."commissionPercent" / 100.0)) AS total_commission,
    COALESCE(SUM(cp.amount_paid), 0) AS total_paid,
    ((c.base_comissao * (c."commissionPercent" / 100.0)) - COALESCE(SUM(cp.amount_paid), 0)) AS remaining_balance
FROM
    contracts c
JOIN
    clients cl ON c.client_id = cl.id
JOIN
    indicators i ON c.indicator_id = i.id
LEFT JOIN
    commission_payments cp ON c.id = cp.contract_id
GROUP BY
    c.id, c.indicator_id, i.name, cl.name, c.base_comissao, c."commissionPercent", c.environment;

-- Grant select on view to public
GRANT SELECT ON vw_indicator_commission_status TO anon;
GRANT SELECT ON vw_indicator_commission_status TO authenticated;

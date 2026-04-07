-- Fix Audit Triggers to exclude Views
-- This script reapplies audit triggers only to BASE TABLES, avoiding errors with Views.

DO $$
DECLARE
  t text;
BEGIN
  -- Iterate only over BASE TABLES, excluding views and specific system/audit tables
  FOR t IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE' 
      AND table_name != 'audit_logs' 
      AND table_name != 'system_settings'
  LOOP
    -- Drop existing trigger if it exists (safe to run even if it doesn't)
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON %I', t, t);
    
    -- Create the trigger
    EXECUTE format('CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION log_audit_event()', t, t);
  END LOOP;
END $$;

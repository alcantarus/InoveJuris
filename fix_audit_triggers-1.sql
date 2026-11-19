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
    
    -- Create the trigger. user_sessions is updated by the 20s heartbeat and
    -- every session validation; auditing UPDATE would generate ~80% of
    -- audit_logs and unnecessary WAL. Login is logged explicitly by
    -- app_authenticate (action='login'), so INSERT/DELETE remain audited.
    IF t = 'user_sessions' THEN
      EXECUTE format('CREATE TRIGGER audit_%I AFTER INSERT OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION log_audit_event()', t, t);
    ELSE
      EXECUTE format('CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION log_audit_event()', t, t);
    END IF;
  END LOOP;
END $$;

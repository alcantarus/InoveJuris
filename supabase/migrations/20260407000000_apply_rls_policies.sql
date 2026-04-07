-- ==============================================================================
-- MIGRATION: APLICAÇÃO DE POLÍTICAS RLS ROBUSTAS
-- ==============================================================================
-- Este script aplica políticas RLS baseadas em 'custom.organization_id' e 'app.current_env'.

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('geo_cache', 'users', 'organizations', 'system_settings', 'roles', 'permissions', 'role_permissions', 'user_roles', 'audit_logs')
    LOOP
        -- Remove políticas existentes
        EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %I" ON %I', t, t);
        
        -- Cria nova política de isolamento
        EXECUTE format('
            CREATE POLICY "Isolamento por Tenant e Ambiente em %I" ON %I
            FOR ALL
            USING (
                organization_id::TEXT = current_setting(''custom.organization_id'', true) AND
                environment = current_setting(''app.current_env'', true)
            )
            WITH CHECK (
                organization_id::TEXT = current_setting(''custom.organization_id'', true) AND
                environment = current_setting(''app.current_env'', true)
            )
        ', t, t);
        
        RAISE NOTICE 'Política RLS aplicada à tabela %', t;
    END LOOP;
END $$;

-- Recarregar cache
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

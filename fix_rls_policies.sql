-- Script para corrigir políticas de RLS para filtrar por organization_id
DO $$
DECLARE
  t text;
BEGIN
  -- Itera sobre todas as tabelas na schema 'public'
  FOR t IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
  LOOP
    -- Verifica se a tabela tem a coluna organization_id
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = t 
        AND column_name = 'organization_id'
    ) THEN
      -- Remove a política permissiva antiga
      EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %I" ON %I', t, t);
      
      -- Cria a política correta baseada na organização
      EXECUTE format('DROP POLICY IF EXISTS "Filter by organization" ON %I', t);
      EXECUTE format('CREATE POLICY "Filter by organization" ON %I FOR ALL USING (organization_id = (current_setting(''app.current_organization_id'', true))::uuid) WITH CHECK (organization_id = (current_setting(''app.current_organization_id'', true))::uuid)', t);
      
      RAISE NOTICE 'RLS policy updated for table: %', t;
    END IF;
  END LOOP;
END $$;

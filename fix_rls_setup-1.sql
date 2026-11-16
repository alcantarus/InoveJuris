-- Corrigir configuração de RLS para ignorar Views
-- Este script aplica RLS apenas em TABELAS BASE, evitando erros com Views.

DO $$
DECLARE
  t text;
BEGIN
  -- Itera apenas sobre TABELAS BASE (BASE TABLE), excluindo views
  FOR t IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
  LOOP
    -- Habilita RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    
    -- Recria políticas de acesso (permissivas por padrão para evitar bloqueios)
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %I" ON %I', t, t);
    EXECUTE format('CREATE POLICY "Allow all access to %I" ON %I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

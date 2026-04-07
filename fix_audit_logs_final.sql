-- ==============================================================================
-- SCRIPT PARA CORRIGIR ERRO DE SINTAXE NO AUDIT LOG (BIGINT vs UUID)
-- ==============================================================================
-- O erro ocorre porque a função log_audit_event tenta converter IDs de tabelas 
-- que usam UUID para BIGINT. Este script altera o record_id para TEXT.

DO $$
BEGIN
    -- 1. Alterar a coluna record_id para TEXT na tabela audit_logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'record_id') THEN
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'record_id') = 'bigint' THEN
            ALTER TABLE audit_logs ALTER COLUMN record_id TYPE TEXT USING record_id::text;
            RAISE NOTICE 'Coluna record_id alterada para TEXT na tabela audit_logs.';
        END IF;
    END IF;
END $$;

-- 2. Atualizar a função log_audit_event para tratar record_id como TEXT
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  changed_fields JSONB;
  performed_by BIGINT;
  record_id TEXT; -- Alterado de BIGINT para TEXT
  v_env TEXT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    new_data = to_jsonb(NEW);
    old_data = null;
    changed_fields = null;
    
    IF new_data ? 'created_by' THEN
      performed_by = (new_data->>'created_by')::BIGINT;
    ELSE
      performed_by = NULL;
    END IF;
    
    IF new_data ? 'environment' AND new_data->>'environment' IS NOT NULL THEN
      v_env = new_data->>'environment';
    ELSE
      v_env = 'production';
    END IF;
    
    record_id = new_data->>'id'; -- Removido cast para BIGINT
  ELSIF (TG_OP = 'UPDATE') THEN
    new_data = to_jsonb(NEW);
    old_data = to_jsonb(OLD);
    SELECT jsonb_object_agg(key, value) INTO changed_fields
    FROM jsonb_each(new_data)
    WHERE old_data->key IS DISTINCT FROM value;
    
    IF new_data ? 'updated_by' THEN
      performed_by = (new_data->>'updated_by')::BIGINT;
    ELSIF new_data ? 'created_by' THEN
      performed_by = (new_data->>'created_by')::BIGINT;
    ELSE
      performed_by = NULL;
    END IF;
    
    IF new_data ? 'environment' AND new_data->>'environment' IS NOT NULL THEN
      v_env = new_data->>'environment';
    ELSE
      v_env = 'production';
    END IF;
    
    record_id = new_data->>'id'; -- Removido cast para BIGINT
  ELSIF (TG_OP = 'DELETE') THEN
    new_data = null;
    old_data = to_jsonb(OLD);
    changed_fields = null;
    performed_by = NULL;
    
    IF old_data ? 'environment' AND old_data->>'environment' IS NOT NULL THEN
      v_env = old_data->>'environment';
    ELSE
      v_env = 'production';
    END IF;
    
    record_id = old_data->>'id'; -- Removido cast para BIGINT
  END IF;

  INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, performed_by, environment)
  VALUES (TG_TABLE_NAME, record_id, TG_OP, old_data, new_data, changed_fields, performed_by, v_env);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Notificar PostgREST
NOTIFY pgrst, 'reload schema';

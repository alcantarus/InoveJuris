-- ==============================================================================
-- SCRIPT DE CORREÇÃO COMPLETA (MARKETING + CLIENTES)
-- ==============================================================================

-- 1. Garante que a coluna photo_url existe na tabela clients
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'photo_url') THEN
        ALTER TABLE clients ADD COLUMN photo_url TEXT;
    END IF;
END $$;

-- 2. Habilita extensão para UUID (necessário para as tabelas de marketing)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Tabela de Templates de Cartão
CREATE TABLE IF NOT EXISTS birthday_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  text_color TEXT DEFAULT '#ffffff',
  name_y TEXT DEFAULT '40%',
  name_x TEXT DEFAULT '50%',
  name_size TEXT DEFAULT '36px',
  name_max_width TEXT DEFAULT '80%',
  msg_y TEXT DEFAULT '60%',
  msg_x TEXT DEFAULT '50%',
  msg_size TEXT DEFAULT '14px',
  msg_max_width TEXT DEFAULT '80%',
  line_height TEXT DEFAULT '1.2',
  text_align TEXT DEFAULT 'center',
  show_client_photo BOOLEAN DEFAULT false,
  photo_x TEXT DEFAULT '50%',
  photo_y TEXT DEFAULT '20%',
  photo_size TEXT DEFAULT '80px',
  photo_shape TEXT DEFAULT 'circle',
  is_active BOOLEAN DEFAULT true,
  environment TEXT DEFAULT 'production',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Mensagens de Aniversário
CREATE TABLE IF NOT EXISTS birthday_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  environment TEXT DEFAULT 'production',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de Logs de Marketing
-- Nota: client_id ajustado para BIGINT para corresponder à tabela clients
CREATE TABLE IF NOT EXISTS marketing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id BIGINT NOT NULL, 
  template_id UUID,
  type TEXT DEFAULT 'birthday_card',
  environment TEXT DEFAULT 'production',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Habilita RLS (Segurança) para as novas tabelas
ALTER TABLE birthday_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_logs ENABLE ROW LEVEL SECURITY;

-- 7. Cria políticas de acesso permissivas (para evitar erros de permissão inicial)
DO $$
BEGIN
    -- Birthday Templates
    DROP POLICY IF EXISTS "Allow all access to birthday_templates" ON birthday_templates;
    CREATE POLICY "Allow all access to birthday_templates" ON birthday_templates FOR ALL USING (true) WITH CHECK (true);

    -- Birthday Messages
    DROP POLICY IF EXISTS "Allow all access to birthday_messages" ON birthday_messages;
    CREATE POLICY "Allow all access to birthday_messages" ON birthday_messages FOR ALL USING (true) WITH CHECK (true);

    -- Marketing Logs
    DROP POLICY IF EXISTS "Allow all access to marketing_logs" ON marketing_logs;
    CREATE POLICY "Allow all access to marketing_logs" ON marketing_logs FOR ALL USING (true) WITH CHECK (true);
END $$;

-- 8. Notifica o PostgREST para recarregar o cache de schema (Funciona no Supabase)
NOTIFY pgrst, 'reload config';

-- ==============================================================================
-- SCRIPT DE CORREÇÃO E REMOÇÃO DE FOTO (MARKETING + CLIENTES)
-- ==============================================================================

-- 1. Remover coluna photo_url da tabela clients
ALTER TABLE clients DROP COLUMN IF EXISTS photo_url;

-- 2. Corrigir tabela birthday_templates (ID de BIGINT para UUID e remover colunas de foto)
DO $$
BEGIN
    -- Verifica se a tabela existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'birthday_templates') THEN
        
        -- Renomeia a tabela atual para backup
        ALTER TABLE birthday_templates RENAME TO birthday_templates_old;
        
        -- Cria a nova tabela com a estrutura correta (UUID e sem colunas de foto)
        CREATE TABLE birthday_templates (
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
          is_active BOOLEAN DEFAULT true,
          environment TEXT DEFAULT 'production',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Migra os dados da tabela antiga para a nova (gerando novos UUIDs)
        -- Ignora as colunas de foto que existiam na antiga
        INSERT INTO birthday_templates (
            name, image_url, text_color, name_y, name_x, name_size, name_max_width, 
            msg_y, msg_x, msg_size, msg_max_width, line_height, text_align, 
            is_active, environment, created_at
        )
        SELECT 
            name, image_url, text_color, name_y, name_x, name_size, name_max_width, 
            msg_y, msg_x, msg_size, msg_max_width, line_height, text_align, 
            is_active, environment, created_at
        FROM birthday_templates_old;
        
        -- Remove a tabela antiga
        DROP TABLE birthday_templates_old;
        
    END IF;
END $$;

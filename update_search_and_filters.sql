-- ==============================================================================
-- ATUALIZAÇÃO DE BUSCA, FILTROS E NOTIFICAÇÕES (VERSÃO CORRIGIDA)
-- ==============================================================================

-- 1. Ativar extensão unaccent para busca ignorando acentos
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Função específica de busca de clientes ignorando acentos
-- Uso: SELECT * FROM search_clients('joao');
CREATE OR REPLACE FUNCTION search_clients(search_term TEXT)
RETURNS SETOF clients AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM clients
  WHERE unaccent(name) ILIKE unaccent('%' || search_term || '%')
     OR unaccent(email) ILIKE unaccent('%' || search_term || '%');
END;
$$ LANGUAGE plpgsql;

-- 3. Função para verificar aniversariantes do dia e criar notificações
-- Esta função deve ser agendada para rodar diariamente (ex: via pg_cron ou trigger externa)
CREATE OR REPLACE FUNCTION check_daily_birthdays() RETURNS void AS $$
DECLARE
  client_record RECORD;
  user_record RECORD;
  notification_exists BOOLEAN;
BEGIN
  -- Percorre todos os clientes que fazem aniversário hoje
  FOR client_record IN 
    SELECT id, name, "birthDate"
    FROM clients
    WHERE 
      "birthDate" IS NOT NULL AND
      EXTRACT(MONTH FROM "birthDate") = EXTRACT(MONTH FROM CURRENT_DATE) AND
      EXTRACT(DAY FROM "birthDate") = EXTRACT(DAY FROM CURRENT_DATE)
  LOOP
    -- Para cada usuário (assumindo que todos devem receber, ou filtrar por status se existir)
    -- Se a tabela users não tiver coluna status, remova o WHERE
    FOR user_record IN SELECT id FROM users LOOP
      
      -- Verifica se já existe notificação para este cliente E usuário hoje
      SELECT EXISTS (
        SELECT 1 FROM notifications 
        WHERE 
          type = 'birthday' AND 
          user_id = user_record.id AND
          message LIKE '%' || client_record.name || '%' AND
          created_at::date = CURRENT_DATE
      ) INTO notification_exists;

      -- Se não existe, cria a notificação
      IF NOT notification_exists THEN
        INSERT INTO notifications (title, message, type, user_id, is_read)
        VALUES (
          'Aniversariante do Dia',
          'Hoje é o aniversário do cliente ' || client_record.name || '!',
          'birthday',
          user_record.id,
          false
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Índices para performance de filtros por data
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions(date);
CREATE INDEX IF NOT EXISTS idx_clients_birthdate ON clients("birthDate");

-- 6. Adicionar função imutável e índice único para evitar notificações de aniversário duplicadas
CREATE OR REPLACE FUNCTION get_date_from_ts(ts timestamptz) 
RETURNS date AS $$
BEGIN
  RETURN (ts AT TIME ZONE 'UTC')::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Remover a trigger antiga (que não está funcionando como esperado)
DROP TRIGGER IF EXISTS trg_prevent_duplicate_birthday ON notifications;
DROP FUNCTION IF EXISTS prevent_duplicate_birthday_notification();

-- Remover duplicatas antes de criar o índice
DELETE FROM notifications
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, type, message, get_date_from_ts(created_at)
                   ORDER BY id
               ) as row_num
        FROM notifications
        WHERE type = 'birthday'
    ) t
    WHERE t.row_num > 1
);

-- Criar o índice único usando a função imutável
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_birthday_notification 
ON notifications (user_id, type, message, get_date_from_ts(created_at))
WHERE type = 'birthday';

-- 7. Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';

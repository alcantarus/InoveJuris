-- Atualizar a tabela de configurações para suportar cronograma complexo (JSONB)
ALTER TABLE backup_settings 
DROP COLUMN cron_schedule;

ALTER TABLE backup_settings 
ADD COLUMN schedule JSONB NOT NULL DEFAULT '{"days": [], "time": "00:00"}';

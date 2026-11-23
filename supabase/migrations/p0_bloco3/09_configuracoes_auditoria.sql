-- Lote 09 — configurações e auditoria
--
-- Leitura com sessão válida; escrita permanece nas rotas servidor (service
-- role) e nas RPCs. Tabelas de backup continuam sem acesso público.

do $$
begin
  perform public._p0_drop_permissive(array['system_settings', 'audit_logs']);
  perform public._p0_apply_readonly(array['system_settings', 'audit_logs']);
end $$;

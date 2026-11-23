-- Lote 11 (extra) — tabelas fora do inventário original do Bloco 3.
--
-- A verificação ampla (query 1 do verify.sql sem a lista fixa de tabelas)
-- encontrou 6 tabelas com policy `using (true)`:
--   backup_logs, birthday_templates_backup, legal_contract_workflow,
--   legal_contracts, organizations, user_organizations.
--
-- Nenhuma é usada diretamente pelo app. `backup_logs` é escrita apenas pela
-- rota servidor de backup (service role, que ignora RLS). Mesmo assim, manter
-- `using (true)` deixa um furo de acesso público.
--
-- Aplicamos somente leitura com sessão válida. Escrita fica restrita ao
-- servidor (service role) — nenhuma escrita do navegador depende destas tabelas.
-- Tabelas inexistentes são ignoradas pelos helpers.

do $$
begin
  perform public._p0_drop_permissive(array[
    'backup_logs', 'birthday_templates_backup',
    'legal_contract_workflow', 'legal_contracts',
    'organizations', 'user_organizations'
  ]);
  perform public._p0_apply_readonly(array[
    'backup_logs', 'birthday_templates_backup',
    'legal_contract_workflow', 'legal_contracts',
    'organizations', 'user_organizations'
  ]);
end $$;

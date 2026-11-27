-- FORWARD - limpeza das tabelas historicas de backup
-- 26/11/2026
--
-- Decisao explicita do usuario: manter somente public.backup_logs.
-- Antes: 18 tabelas com "backup" no nome. Depois: 1.
--
-- Pre-condicao obrigatoria: exportacao das 17 tabelas concluida e hash conferido:
--   C:\Users\ALCANTARUS\Backups\InoveJuris\pre-tenant-20261126\rollback-17-tabelas-backup-20261126.sql
--
-- Verificado antes do forward:
--   - nenhuma FK de entrada ou saida nas 17 tabelas;
--   - nenhuma view e nenhuma funcao do banco referencia as 17 tabelas;
--   - nenhum arquivo .ts/.tsx/.js do app referencia as 17 tabelas;
--   - backup_logs fica intocada (0 linhas; usada por /api/backup/generate);
--   - 73 tabelas public, 63 policies; 1 policy sera removida junto.
--
-- Nao altera dado de negocio. Nao mexe em production nem em test.
-- NAO EXECUTAR SEM AUTORIZACAO EXPLICITA DO USUARIO.
-- Depois: docs/VERIFY-LIMPEZA-BACKUPS-20261126.sql
-- Para desfazer: docs/ROLLBACK-LIMPEZA-BACKUPS-20261126.sql

begin;

do $$
declare
  v_total integer;
begin
  select count(*) into v_total
    from information_schema.tables
   where table_schema = 'public'
     and table_type = 'BASE TABLE'
     and table_name like '%backup%';

  if v_total <> 18 then
    raise exception 'Abortando: esperadas 18 tabelas com backup, encontradas %', v_total;
  end if;

  if to_regclass('public.backup_logs') is null then
    raise exception 'Abortando: public.backup_logs nao encontrada';
  end if;
end $$;

drop table if exists public._auth_hardening_policy_backup_20261118;
drop table if exists public.backup_b11_projecao_20261121;
drop table if exists public.backup_contracts_20261121;
drop table if exists public.backup_contracts_status_endurecimento_20261121;
drop table if exists public.backup_contratos_protecao_20261125;
drop table if exists public.backup_estornado_recebivel_20261126;
drop table if exists public.backup_estornado_recebivel_dados_20261126;
drop table if exists public.backup_installments_20261121;
drop table if exists public.backup_payments_20261121;
drop table if exists public.backup_recebimento_desdobramento_20261125;
drop table if exists public.backup_test_ajuste_final_20261121;
drop table if exists public.backup_test_ajuste_final_pagamentos_20261121;
drop table if exists public.backup_test_contracts_conciliacao_20261121;
drop table if exists public.backup_test_installments_conciliacao_20261121;
drop table if exists public.backup_test_pagamentos_conciliacao_20261121;
drop table if exists public.backup_view_receivables_20261121;
drop table if exists public.birthday_templates_backup;

commit;

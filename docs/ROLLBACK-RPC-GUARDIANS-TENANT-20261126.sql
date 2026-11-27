-- ROLLBACK - RPC save_client_guardians
-- 26/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Restaura somente o corpo salvo de save_client_guardians.
-- Nao remove o helper (usado tambem pelas RPCs de prazos).
-- A linha de backup e preservada como evidencia.
-- Para conferir, rode docs/VERIFY-RPCS-ESCRITA-TENANT-20261126.sql:
-- o hash deve voltar a 2b1b80269f809d61f895ce9fdfe381fd.

begin;

do $$
declare
  r record;
begin
  for r in
    select def from public._tenant_rpc_backup_20261126
     where nome = 'save_client_guardians'
  loop
    execute r.def;
  end loop;
end $$;

commit;

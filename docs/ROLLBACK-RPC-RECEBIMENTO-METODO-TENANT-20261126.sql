-- ROLLBACK - RPC rpc_receber_parcela_com_metodo
-- 26/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Restaura somente o corpo salvo de rpc_receber_parcela_com_metodo.
-- Nao remove o helper (usado pelas RPCs anteriores).
-- A linha de backup e preservada como evidencia.
-- Para conferir, rode docs/VERIFY-RPCS-ESCRITA-TENANT-20261126.sql:
-- o hash deve voltar a b7d47249ea33e62627686a35c81a5ae8.

begin;

do $$
declare
  r record;
begin
  for r in
    select def from public._tenant_rpc_backup_20261126
     where nome = 'rpc_receber_parcela_com_metodo'
  loop
    execute r.def;
  end loop;
end $$;

commit;

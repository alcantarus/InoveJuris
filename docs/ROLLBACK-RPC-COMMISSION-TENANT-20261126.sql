-- ROLLBACK - RPC app_register_commission_payment
-- 26/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Restaura somente o corpo salvo de app_register_commission_payment.
-- Nao remove o helper (usado pelas RPCs de prazos e guardians).
-- A linha de backup e preservada como evidencia.
-- Para conferir, rode docs/VERIFY-RPCS-ESCRITA-TENANT-20261126.sql:
-- o hash deve voltar a 76f9b818d62ac7f0dde005ada25d48c3.

begin;

do $$
declare
  r record;
begin
  for r in
    select def from public._tenant_rpc_backup_20261126
     where nome = 'app_register_commission_payment'
  loop
    execute r.def;
  end loop;
end $$;

commit;

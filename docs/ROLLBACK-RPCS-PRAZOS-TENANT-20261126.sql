-- ROLLBACK - RPCs de prazos
-- 26/11/2026
--
-- Ambiente declarado: production + test (banco unico).
-- Restaura o corpo EXATO salvo pelo FORWARD e remove o helper.
-- A tabela de backup e preservada como evidencia.
-- Para conferir, rode novamente docs/VERIFY-RPCS-ESCRITA-TENANT-20261126.sql:
-- os hashes devem voltar aos valores do diagnostico 20:23Z.

begin;

do $$
declare
  r record;
begin
  if to_regprocedure('public._tenant_claim_organization_id()') is not null then
    execute 'drop function public._tenant_claim_organization_id()';
  end if;

  for r in
    select def from public._tenant_rpc_backup_20261126 order by id
  loop
    execute r.def;
  end loop;
end $$;

commit;

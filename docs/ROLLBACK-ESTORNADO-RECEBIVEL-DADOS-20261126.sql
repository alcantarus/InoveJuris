-- ROLLBACK (DADOS) — devolver `contracts.amountReceivable` ao valor original
-- 26/11/2026
--
-- REGRA PERMANENTE: um único banco; production e test são valores da coluna
-- environment, não bancos separados.
--
-- Desfaz apenas o UPDATE de docs/FORWARD-ESTORNADO-RECEBIVEL-DADOS-20261126.sql,
-- restaurando os valores guardados em
-- public.backup_estornado_recebivel_dados_20261126. Não mexe em status, pagos,
-- parcelas, pagamentos nem movimentações.
--
-- Se o backup não existir, não faz nada. A tabela de backup é mantida para
-- auditoria. Este rollback NÃO desfaz a parte estrutural; para isso usar
-- docs/ROLLBACK-ESTORNADO-RECEBIVEL-20261126.sql.

begin;

do $rb$
declare
  v_ok int;
begin
  if to_regclass('public.backup_estornado_recebivel_dados_20261126') is null then
    raise notice 'Backup inexistente: nada a desfazer.';
    return;
  end if;

  with restaurado as (
    update public.contracts c
       set "amountReceivable" = b.amount_receivable_antes
      from public.backup_estornado_recebivel_dados_20261126 b
     where c.id = b.contract_id
       and c."amountReceivable" is distinct from b.amount_receivable_antes
    returning c.id
  )
  select count(*) into v_ok from restaurado;

  raise notice 'Contratos restaurados: %.', coalesce(v_ok, 0);
end
$rb$;

commit;

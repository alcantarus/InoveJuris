-- ROLLBACK (DADOS) — devolver amountReceivable ao valor anterior
-- 27/11/2026 — PREPARADO, NÃO EXECUTADO
-- Só faz sentido depois do FORWARD-DADOS ter sido executado.

begin;

update public.contracts c
   set "amountReceivable" = b.amount_receivable_antes
  from public.backup_dados_receivable_20261127 b
 where c.id = b.contract_id
   and c."amountReceivable" is distinct from b.amount_receivable_antes;

select current_database() as database,
       (select count(*) from public.backup_dados_receivable_20261127) as linhas_no_backup,
       (select count(*) from public.contracts c
         join public.backup_dados_receivable_20261127 b on b.contract_id = c.id
        where c."amountReceivable" = b.amount_receivable_antes) as restauradas;

commit;

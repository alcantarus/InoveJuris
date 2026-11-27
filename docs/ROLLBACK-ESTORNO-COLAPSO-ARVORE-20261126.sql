-- ============================================================================
-- ROLLBACK — estorno com colapso (PREPARADO, NÃO EXECUTADO)
-- 26/11/2026
--
-- Remove somente a RPC nova. Não altera dados: linhas já marcadas como
-- Reabsorvida permanecem e exigiriam decisão/autorização separada para voltar
-- à árvore.
-- ============================================================================

begin;

drop function if exists public.process_installment_estorno_colapso(bigint, text, bigint, bigint);

select current_database() as database,
       (select count(*) from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname = 'process_installment_estorno_colapso') as rpc_restante,
       (select count(*) from public.installments where status = 'Reabsorvida') as reabsorvidas_preservadas,
       'dados não alterados' as observacao;

commit;

-- ============================================================================
-- VERIFY — divergência de amountReceivable (somente leitura)
-- 27/11/2026
--
-- Medição prévia antes de qualquer UPDATE. Banco único; agrupa por environment.
-- Sem nomes, e-mails ou linhas completas: só contagens e totais.
-- ============================================================================

begin;

select current_database() as database,
       coalesce(environment::text, 'sem environment') as ambiente,
       count(*) as contratos,
       count(*) filter (
         where abs(
           coalesce("amountReceivable", 0) -
           greatest(coalesce("contractValue", 0) - coalesce("amountReceived", 0), 0)
         ) > 0.01
       ) as divergentes,
       sum(
         greatest(coalesce("contractValue", 0) - coalesce("amountReceived", 0), 0)
       ) as total_esperado
  from public.contracts
 group by 2
 order by 2;

select current_database() as database,
       'gatilho v5' as bloco,
       count(*) as encontrado,
       case when exists (
         select 1 from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname = 'fn_recalculate_contract_totals'
            and pg_get_functiondef(p.oid) like '%v5 20261127%'
       ) then 'OK' else 'PENDENTE' end as situacao;

select current_database() as database,
       'contrato 138' as bloco,
       (select "contractValue" from public.contracts where id = 138) as valor_contrato,
       (select "amountReceived" from public.contracts where id = 138) as recebido,
       (select "amountReceivable" from public.contracts where id = 138) as gravado,
       (select greatest(
           coalesce((select "contractValue" from public.contracts where id = 138), 0) -
           coalesce((select "amountReceived" from public.contracts where id = 138), 0), 0
       )) as esperado;

rollback;

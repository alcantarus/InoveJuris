-- ============================================================================
-- FORWARD (DADOS) — recalcula amountReceivable dos contratos divergentes
-- 27/11/2026 — PREPARADO, NÃO EXECUTADO
--
-- ⚠️ NÃO EXECUTAR SEM AUTORIZAÇÃO EXPLÍCITA DO USUÁRIO.
-- Faz UPDATE apenas em contracts.amountReceivable, sem mover linhas entre
-- ambientes. Guarda os valores anteriores em tabela de backup.
-- ============================================================================

begin;

create table if not exists public.backup_dados_receivable_20261127 (
  contract_id bigint primary key,
  environment text,
  amount_receivable_antes numeric(12,2),
  amount_receivable_depois numeric(12,2),
  created_at timestamptz not null default now()
);

insert into public.backup_dados_receivable_20261127 (
  contract_id, environment, amount_receivable_antes, amount_receivable_depois
)
select c.id,
       c.environment::text,
       c."amountReceivable",
       greatest(coalesce(c."contractValue", 0) - coalesce(c."amountReceived", 0), 0)
  from public.contracts c
 where abs(
   coalesce(c."amountReceivable", 0) -
   greatest(coalesce(c."contractValue", 0) - coalesce(c."amountReceived", 0), 0)
 ) > 0.01
on conflict (contract_id) do nothing;

update public.contracts c
   set "amountReceivable" = greatest(
         coalesce(c."contractValue", 0) - coalesce(c."amountReceived", 0), 0
       )
 where abs(
   coalesce(c."amountReceivable", 0) -
   greatest(coalesce(c."contractValue", 0) - coalesce(c."amountReceived", 0), 0)
 ) > 0.01;

select current_database() as database,
       (select count(*) from public.backup_dados_receivable_20261127) as contratos_ajustados,
       (select count(*) from public.contracts c
         where abs(
           coalesce(c."amountReceivable", 0) -
           greatest(coalesce(c."contractValue", 0) - coalesce(c."amountReceived", 0), 0)
         ) > 0.01) as divergentes_apos;

commit;

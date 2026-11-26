-- FORWARD (DADOS) — recalcular `contracts.amountReceivable` após alinhar
-- `Estornado` como título a receber
-- 26/11/2026
--
-- ATENÇÃO: ESTE SCRIPT FAZ UPDATE EM DADOS DE NEGÓCIO.
-- NÃO EXECUTAR SEM AUTORIZAÇÃO EXPLÍCITA DO USUÁRIO.
--
-- Por que existe: o gatilho v4 recalcula `amountReceivable` somente quando há
-- evento em installments/payments. Após a mudança estrutural, os contratos que
-- já tinham parcela estornada ficariam com o valor antigo até o próximo
-- recebimento. Esta correção aplica a nova regra apenas a esses contratos.
--
-- Medição prévia (12:38:50 UTC): 3 contratos em test (R$ 15.000,00 de saldo
-- estornado) e 0 em production. Se a contagem atual divergir ou houver
-- contrato de production afetado, o script aborta antes do UPDATE.
--
-- REGRA PERMANENTE: um único banco; production e test são valores da coluna
-- environment, não bancos separados.
--
-- Não altera status, valores pagos, parcelas, pagamentos nem movimentações.
-- Para desfazer: docs/ROLLBACK-ESTORNADO-RECEBIVEL-DADOS-20261126.sql.
-- Pré-requisito: FORWARD estrutural já aplicado.

begin;

create table if not exists public.backup_estornado_recebivel_dados_20261126 (
  contract_id           bigint primary key,
  environment           text not null,
  amount_receivable_antes numeric(12,2),
  capturado_em          timestamptz not null default now()
);

insert into public.backup_estornado_recebivel_dados_20261126
  (contract_id, environment, amount_receivable_antes)
select c.id, c.environment, c."amountReceivable"
  from public.contracts c
 where exists (
   select 1 from public.installments i
    where i.contract_id = c.id
      and lower(btrim(coalesce(i.status, ''))) in ('estornado', 'estornada')
 )
on conflict (contract_id) do nothing;

do $guard$
declare
  v_total  int;
  v_test   int;
  v_prod   int;
begin
  select count(*),
         count(*) filter (where environment = 'test'),
         count(*) filter (where environment = 'production')
    into v_total, v_test, v_prod
    from public.backup_estornado_recebivel_dados_20261126;

  if v_total > 10 then
    raise exception
      'Abortado: % contratos afetados, acima do esperado (3). Nada foi alterado.', v_total;
  end if;
  if v_prod > 0 then
    raise exception
      'Abortado: % contrato(s) de production afetado(s). Exige avaliação explícita. Nada foi alterado.', v_prod;
  end if;
  raise notice 'Contratos elegíveis para recálculo: % (test=%, production=%).', v_total, v_test, v_prod;
end
$guard$;

with calculado as (
  select c.id as contract_id,
         coalesce(sum(greatest(
           i.amount - coalesce(i."amountPaid", 0), 0
         )) filter (
           where lower(btrim(coalesce(i.status, '')))
                 not in ('quitado', 'cancelado', 'cancelada')
         ), 0) as novo_receivable
    from public.contracts c
    join public.installments i on i.contract_id = c.id
   where c.id in (select contract_id from public.backup_estornado_recebivel_dados_20261126)
   group by c.id
)
update public.contracts c
   set "amountReceivable" = cal.novo_receivable
  from calculado cal
 where c.id = cal.contract_id
   and c."amountReceivable" is distinct from cal.novo_receivable;

select jsonb_pretty(jsonb_build_object(
  'atualizado_em', now(),
  'banco_unico', 'production e test são valores da coluna environment, não bancos separados.',
  'contratos', (
    select jsonb_agg(jsonb_build_object(
      'contract_id', c.id,
      'environment', c.environment,
      'antes', b.amount_receivable_antes,
      'depois', c."amountReceivable"
    ) order by c.id)
      from public.contracts c
      join public.backup_estornado_recebivel_dados_20261126 b on b.contract_id = c.id
  )
)) as correcao_amount_receivable_20261126;

commit;

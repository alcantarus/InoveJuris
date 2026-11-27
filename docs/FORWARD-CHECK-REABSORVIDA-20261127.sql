-- ============================================================================
-- PATCH — liberar status 'Reabsorvida' em check_installment_status
-- 27/11/2026
--
-- Necessário em TEST porque o FORWARD da RPC já foi rodado lá antes desta
-- correção. Em PRODUCTION, rodar o FORWARD-ESTORNO-COLAPSO completo (ele já
-- contém este passo).
--
-- Nenhum dado é alterado: apenas a constraint da coluna status.
-- ============================================================================

begin;

do $status$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'check_installment_status'
       and conrelid = 'public.installments'::regclass
  ) then
    raise exception 'Abortado: check_installment_status não encontrada.';
  end if;

  if exists (
    select 1 from pg_constraint
     where conname = 'check_installment_status'
       and conrelid = 'public.installments'::regclass
       and pg_get_constraintdef(oid) like '%Reabsorvida%'
  ) then
    raise notice 'check_installment_status já aceita Reabsorvida; nada a fazer.';
  else
    execute 'alter table public.installments drop constraint check_installment_status';
    execute $ddl$
      alter table public.installments add constraint check_installment_status
      check (status in (
        'Aberto', 'Parcial', 'Quitado', 'Cancelado', 'Cancelada',
        'Prorrogada', 'Prorrogado', 'Atrasada', 'Estornado', 'Reabsorvida'
      ))
    $ddl$;
  end if;
end
$status$;

select current_database() as database,
       (select count(*) from pg_constraint
         where conname = 'check_installment_status'
           and conrelid = 'public.installments'::regclass
           and pg_get_constraintdef(oid) like '%Reabsorvida%') as aceita_reabsorvida,
       (select count(*) from public.installments
         where status = 'Reabsorvida') as linhas_reabsorvidas;

commit;

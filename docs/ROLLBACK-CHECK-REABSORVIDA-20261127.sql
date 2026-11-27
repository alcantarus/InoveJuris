-- ============================================================================
-- ROLLBACK do patch check_installment_status (PREPARADO, NÃO EXECUTADO)
-- 27/11/2026
--
-- Só execute se ainda não houver linhas com status 'Reabsorvida'.
-- ============================================================================

begin;

do $status$
begin
  if exists (select 1 from public.installments where status = 'Reabsorvida') then
    raise exception 'Abortado: existem linhas Reabsorvida; não restaurar a constraint sem decisão explícita.';
  end if;

  execute 'alter table public.installments drop constraint if exists check_installment_status';
  execute $ddl$
    alter table public.installments add constraint check_installment_status
    check (status in (
      'Aberto', 'Parcial', 'Quitado', 'Cancelado', 'Cancelada',
      'Prorrogada', 'Prorrogado', 'Atrasada', 'Estornado'
    ))
  $ddl$;
end
$status$;

select current_database() as database,
       (select count(*) from pg_constraint
         where conname = 'check_installment_status'
           and conrelid = 'public.installments'::regclass
           and pg_get_constraintdef(oid) like '%Reabsorvida%') as aceita_reabsorvida;

commit;

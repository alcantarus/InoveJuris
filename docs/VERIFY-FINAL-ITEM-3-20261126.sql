-- VERIFY - consolidacao final do item 3
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Nao mostra dados de negocio: apenas estado de objetos e contagens.

begin;

select jsonb_pretty(jsonb_build_object(
  'ambiente_declarado', 'production + test',
  'verificado_em', now(),

  'helper_claim', to_regprocedure('public._tenant_claim_organization_id()') is not null,

  'system_settings', jsonb_build_object(
    'unique_tenant_presente', coalesce((
      select pg_get_constraintdef(oid) ilike '%NULLS NOT DISTINCT%'
        from pg_constraint
       where conrelid = 'public.system_settings'::regclass
         and conname = 'uq_system_settings_key_environment_organization'
         and contype = 'u'
    ), false),
    'pk_antiga_removida', not coalesce((
      select exists (
        select 1 from pg_constraint
         where conrelid = 'public.system_settings'::regclass
           and conname = 'system_settings_pkey'
           and contype = 'p'
      )
    ), false),
    'organization_id_permite_nulo', coalesce((
      select attnotnull = false
        from pg_attribute
       where attrelid = 'public.system_settings'::regclass
         and attname = 'organization_id'
         and not attisdropped
    ), false)
  ),

  'rpc_backup_linhas', (select count(*) from public._tenant_rpc_backup_20261126),

  'rpcs_protegidas', (
    select count(*)
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in (
         'create_process_deadline',
         'update_process_deadline',
         'confirm_process_deadline',
         'delete_process_deadline',
         'save_client_guardians',
         'app_register_commission_payment',
         'rpc_receber_parcela_com_metodo'
       )
       and pg_get_functiondef(p.oid) ilike '%_tenant_claim_organization_id%'
  ),

  'guard_funcao', to_regprocedure('public._tenant_guard_dml_fn()') is not null,

  'guard_triggers_ativas', (
    select count(*)
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where not t.tgisinternal
       and t.tgname = 'zz_tenant_guard_dml'
       and t.tgenabled = 'O'
       and t.tgtype = 31
       and c.relnamespace = 'public'::regnamespace
       and c.relname in (
         'installments', 'payments', 'financial_transactions',
         'contracts', 'commission_payments'
       )
  ),

  'item3_concluido', (
       to_regprocedure('public._tenant_claim_organization_id()') is not null
       and coalesce((
         select pg_get_constraintdef(oid) ilike '%NULLS NOT DISTINCT%'
           from pg_constraint
          where conrelid = 'public.system_settings'::regclass
            and conname = 'uq_system_settings_key_environment_organization'
            and contype = 'u'
       ), false)
       and not coalesce((
         select exists (
           select 1 from pg_constraint
            where conrelid = 'public.system_settings'::regclass
              and conname = 'system_settings_pkey'
              and contype = 'p'
         )
       ), false)
       and (select count(*) = 7 from public._tenant_rpc_backup_20261126)
       and (
         select count(*) = 7
           from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname in (
              'create_process_deadline', 'update_process_deadline',
              'confirm_process_deadline', 'delete_process_deadline',
              'save_client_guardians', 'app_register_commission_payment',
              'rpc_receber_parcela_com_metodo'
            )
            and pg_get_functiondef(p.oid) ilike '%_tenant_claim_organization_id%'
       )
       and to_regprocedure('public._tenant_guard_dml_fn()') is not null
       and (
         select count(*) = 5
           from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
          where not t.tgisinternal
            and t.tgname = 'zz_tenant_guard_dml'
            and t.tgenabled = 'O'
            and t.tgtype = 31
            and c.relnamespace = 'public'::regnamespace
            and c.relname in (
              'installments', 'payments', 'financial_transactions',
              'contracts', 'commission_payments'
            )
       )
  )
)) as resumo;

rollback;

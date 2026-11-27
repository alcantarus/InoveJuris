-- VERIFY - guarda de tenant nas tabelas financeiras
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).

begin;

select jsonb_pretty(jsonb_build_object(
  'ambiente_declarado', 'production + test',
  'verificado_em', now(),
  'funcao_existe', to_regprocedure('public._tenant_guard_dml_fn()') is not null,
  'funcao_le_claim', coalesce((
    select pg_get_functiondef('public._tenant_guard_dml_fn()'::regprocedure) ilike '%_tenant_claim_organization_id%'
  ), false),
  'triggers', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'tabela', c.relname,
      'nome', t.tgname,
      'estado', case t.tgenabled when 'O' then 'O' else t.tgenabled::text end,
      'eventos', t.tgtype,
      'funcao', p.proname
    ) order by c.relname), '[]'::jsonb)
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_proc p on p.oid = t.tgfoid
     where not t.tgisinternal
       and t.tgname = 'zz_tenant_guard_dml'
       and c.relnamespace = 'public'::regnamespace
       and c.relname in (
         'installments', 'payments', 'financial_transactions',
         'contracts', 'commission_payments'
       )
  ),
  'total_triggers', (
    select count(*)
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where not t.tgisinternal
       and t.tgname = 'zz_tenant_guard_dml'
       and c.relnamespace = 'public'::regnamespace
       and c.relname in (
         'installments', 'payments', 'financial_transactions',
         'contracts', 'commission_payments'
       )
  ),
  'pronto', (
       to_regprocedure('public._tenant_guard_dml_fn()') is not null
       and coalesce((
         select pg_get_functiondef('public._tenant_guard_dml_fn()'::regprocedure) ilike '%_tenant_claim_organization_id%'
       ), false)
       and (
         select count(*) = 5
           from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
          where not t.tgisinternal
            and t.tgname = 'zz_tenant_guard_dml'
            and t.tgenabled = 'O'
            -- 31 = ROW(1) + BEFORE(2) + INSERT(4) + DELETE(8) + UPDATE(16)
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

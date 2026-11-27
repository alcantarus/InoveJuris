-- VERIFY - inventario das RPCs de escrita antes do item 3
-- 26/11/2026
--
-- Somente leitura. Termina em ROLLBACK.
-- Ambiente declarado: production + test (banco unico).
-- Nao devolve corpo de funcao: apenas assinatura, hash MD5, flags e grants.

begin;

with candidatos(nome, grupo) as (
  values
    ('create_process_deadline',            'usuario'),
    ('update_process_deadline',            'usuario'),
    ('confirm_process_deadline',           'usuario'),
    ('delete_process_deadline',            'usuario'),
    ('rpc_receber_parcela_com_metodo',     'usuario'),
    ('process_installment_estorno',        'usuario'),
    ('process_installment_payment',        'usuario'),
    ('process_contract_cancellation',      'usuario'),
    ('rpc_recebimento_com_desdobramento',  'usuario'),
    ('app_register_commission_payment',    'usuario'),
    ('save_client_guardians',              'usuario'),
    ('update_account_balance',             'usuario'),
    ('app_admin_save_user',                'admin'),
    ('app_admin_delete_user',              'admin'),
    ('app_admin_save_role',                'admin'),
    ('app_admin_delete_role',              'admin'),
    ('app_admin_set_role_permission',      'admin'),
    ('app_admin_terminate_session',        'admin'),
    ('app_admin_trust_device',             'admin'),
    ('app_mark_onboarding_used',           'publico'),
    ('app_touch_indicator_token',          'publico'),
    ('set_app_environment',                'helper')
),
fn as (
  select c.nome,
         c.grupo,
         p.oid,
         p.proacl,
         pg_get_function_identity_arguments(p.oid) as argumentos,
         case when p.prosecdef then 'definer' else 'invoker' end as seguranca,
         pg_get_functiondef(p.oid) as def,
         md5(pg_get_functiondef(p.oid)) as hash_def,
         p.proacl is null as executa_publico
    from candidatos c
    join pg_proc p
      on p.proname = c.nome
     and p.pronamespace = 'public'::regnamespace
)
select jsonb_pretty(jsonb_build_object(
  'ambiente_declarado', 'production + test',
  'verificado_em', now(),
  'total_encontradas', (select count(*) from fn),
  'ausentes', (
    select coalesce(jsonb_agg(c.nome order by c.nome), '[]'::jsonb)
      from candidatos c
     where not exists (select 1 from fn f where f.nome = c.nome)
  ),
  'funcoes', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'nome', f.nome,
      'grupo', f.grupo,
      'argumentos', f.argumentos,
      'seguranca', f.seguranca,
      'hash_def', f.hash_def,
      'executa_publico', f.executa_publico,
      'usa_organization_id', f.def ilike '%organization_id%',
      'usa_claim_jwt', f.def ilike '%request.jwt.claims%'
                      or f.def ilike '%auth.jwt%'
                      or f.def ilike '%_rls_organization_id%',
      'tabelas_escritas', (
        select coalesce(jsonb_agg(t order by t), '[]'::jsonb)
          from unnest(array[
                 'process_deadlines', 'installments', 'payments',
                 'financial_transactions', 'contracts', 'clients',
                 'users', 'system_settings'
               ]) t
         where f.def ~* format('(insert into|update|delete from)[[:space:]]+public\.%s', t)
      ),
      'permissoes', (
        select coalesce(jsonb_agg(r.rolname order by r.rolname), '[]'::jsonb)
          from aclexplode(f.proacl) a
          join pg_roles r on r.oid = a.grantee
         where a.privilege_type = 'EXECUTE'
      )
    ) order by f.grupo, f.nome, f.argumentos), '[]'::jsonb)
    from fn f
  )
)) as resumo;

rollback;

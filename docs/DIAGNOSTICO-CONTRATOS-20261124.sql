-- Diagnóstico somente leitura — Módulo Contratos
-- 24/11/2026
--
-- Objetivo: confirmar em PRODUÇÃO o schema, as functions, triggers, policies,
-- grants e a consistência dos dados do módulo Contratos antes de qualquer
-- correção. O repositório NÃO é a fonte da verdade (há divergências conhecidas).
--
-- Como usar:
--   1) Execute o arquivo INTEIRO no SQL Editor do Supabase.
--   2) Copie apenas a célula `diagnostico_contratos`.
--   3) Nenhum dado de cliente/valor é exibido — apenas contagens e metadados.
--
-- Segurança: não há DDL, DML, GRANT, REVOKE nem chamada de RPC de negócio.
-- Tudo roda em transação que termina em ROLLBACK.

begin;

select set_config('diag.consistencia', '{}'::jsonb::text, true);
select set_config('diag.migracoes', '{}'::jsonb::text, true);

do $$
declare
  v_checks            jsonb := '{}'::jsonb;
  v_num               bigint;
  v_col               text;
  v_inst_num          text;
  v_paid              text;
  v_contract_value    text;
  v_receivable        text;
  v_commission        text;
  v_is_pro_bono       text;
  v_contract_number   text;
begin
  -- -------------------------------------------------------------------------
  -- Helpers de nome de coluna (camelCase no repo, snake_case em produção?)
  -- -------------------------------------------------------------------------
  select column_name into v_inst_num
    from information_schema.columns
   where table_schema = 'public' and table_name = 'installments'
     and column_name in ('installmentNumber', 'installment_number')
   order by case when column_name = 'installmentNumber' then 0 else 1 end
   limit 1;
  if v_inst_num = 'installmentNumber' then v_inst_num := '"installmentNumber"'; end if;

  select column_name into v_paid
    from information_schema.columns
   where table_schema = 'public' and table_name = 'installments'
     and column_name in ('amountPaid', 'amount_paid')
   order by case when column_name = 'amountPaid' then 0 else 1 end
   limit 1;
  if v_paid = 'amountPaid' then v_paid := '"amountPaid"'; end if;

  select column_name into v_contract_value
    from information_schema.columns
   where table_schema = 'public' and table_name = 'contracts'
     and column_name in ('contractValue', 'contract_value')
   order by case when column_name = 'contractValue' then 0 else 1 end
   limit 1;
  if v_contract_value = 'contractValue' then v_contract_value := '"contractValue"'; end if;

  select column_name into v_receivable
    from information_schema.columns
   where table_schema = 'public' and table_name = 'contracts'
     and column_name in ('amountReceivable', 'amount_receivable')
   order by case when column_name = 'amountReceivable' then 0 else 1 end
   limit 1;
  if v_receivable = 'amountReceivable' then v_receivable := '"amountReceivable"'; end if;

  select column_name into v_commission
    from information_schema.columns
   where table_schema = 'public' and table_name = 'contracts'
     and column_name in ('commissionValue', 'commission_value')
   order by case when column_name = 'commissionValue' then 0 else 1 end
   limit 1;
  if v_commission = 'commissionValue' then v_commission := '"commissionValue"'; end if;

  select column_name into v_is_pro_bono
    from information_schema.columns
   where table_schema = 'public' and table_name = 'contracts'
     and column_name in ('isProBono', 'is_pro_bono')
   order by case when column_name = 'isProBono' then 0 else 1 end
   limit 1;
  if v_is_pro_bono = 'isProBono' then v_is_pro_bono := '"isProBono"'; end if;

  select column_name into v_contract_number
    from information_schema.columns
   where table_schema = 'public' and table_name = 'contracts'
     and column_name in ('contractNumber', 'contract_number')
   order by case when column_name = 'contractNumber' then 0 else 1 end
   limit 1;
  if v_contract_number = 'contractNumber' then v_contract_number := '"contractNumber"'; end if;

  -- -------------------------------------------------------------------------
  -- 1) Parcelas duplicadas por (contrato, número)
  -- -------------------------------------------------------------------------
  if v_inst_num is null then
    v_checks := v_checks || jsonb_build_object('parcelas_duplicadas', 'sem coluna de número');
  else
    begin
      execute format(
        'select count(*) from (select contract_id, %s as n from public.installments group by 1, 2 having count(*) > 1) x',
        v_inst_num
      ) into v_num;
      v_checks := v_checks || jsonb_build_object('parcelas_duplicadas', v_num);
    exception when others then
      v_checks := v_checks || jsonb_build_object('parcelas_duplicadas', 'ERRO: ' || sqlerrm);
    end;
  end if;

  -- -------------------------------------------------------------------------
  -- 2) Parcelas com amountPaid acima do valor
  -- -------------------------------------------------------------------------
  if v_paid is null then
    v_checks := v_checks || jsonb_build_object('pagamento_acima_do_valor', 'sem coluna amountPaid');
  else
    begin
      execute format(
        'select count(*) from public.installments where coalesce(%s, 0) > coalesce(amount, 0) + 0.01',
        v_paid
      ) into v_num;
      v_checks := v_checks || jsonb_build_object('pagamento_acima_do_valor', v_num);
    exception when others then
      v_checks := v_checks || jsonb_build_object('pagamento_acima_do_valor', 'ERRO: ' || sqlerrm);
    end;
  end if;

  -- -------------------------------------------------------------------------
  -- 3) Contratos Quitado com parcelas ainda vivas
  -- -------------------------------------------------------------------------
  begin
    execute $q$
      select count(*) from public.contracts c
       where lower(coalesce(c.status, '')) = 'quitado'
         and exists (
           select 1 from public.installments i
            where i.contract_id = c.id
              and lower(coalesce(i.status, '')) not in ('quitado', 'cancelada', 'cancelado', 'estornado')
         )
    $q$ into v_num;
    v_checks := v_checks || jsonb_build_object('quitados_com_parcelas_abertas', v_num);
  exception when others then
    v_checks := v_checks || jsonb_build_object('quitados_com_parcelas_abertas', 'ERRO: ' || sqlerrm);
  end;

  -- -------------------------------------------------------------------------
  -- 4) Contratos Cancelado com parcelas ainda vivas
  -- -------------------------------------------------------------------------
  begin
    execute $q$
      select count(*) from public.contracts c
       where lower(coalesce(c.status, '')) in ('cancelado', 'cancelada')
         and exists (
           select 1 from public.installments i
            where i.contract_id = c.id
              and lower(coalesce(i.status, '')) not in ('quitado', 'cancelada', 'cancelado', 'estornado')
         )
    $q$ into v_num;
    v_checks := v_checks || jsonb_build_object('cancelados_com_parcelas_vivas', v_num);
  exception when others then
    v_checks := v_checks || jsonb_build_object('cancelados_com_parcelas_vivas', 'ERRO: ' || sqlerrm);
  end;

  -- -------------------------------------------------------------------------
  -- 5) Comissão não zerada em contratos cancelados
  -- -------------------------------------------------------------------------
  if v_commission is null then
    v_checks := v_checks || jsonb_build_object('comissao_em_cancelado', 'sem coluna de comissão');
  else
    begin
      execute format(
        'select count(*) from public.contracts where lower(coalesce(status, '''')) in (''cancelado'', ''cancelada'') and coalesce(%s, 0) <> 0',
        v_commission
      ) into v_num;
      v_checks := v_checks || jsonb_build_object('comissao_em_cancelado', v_num);
    exception when others then
      v_checks := v_checks || jsonb_build_object('comissao_em_cancelado', 'ERRO: ' || sqlerrm);
    end;
  end if;

  -- -------------------------------------------------------------------------
  -- 6) Pro bono com saldo em aberto
  -- -------------------------------------------------------------------------
  if v_is_pro_bono is null or v_receivable is null then
    v_checks := v_checks || jsonb_build_object('pro_bono_com_saldo', 'sem colunas necessárias');
  else
    begin
      execute format(
        'select count(*) from public.contracts where coalesce(%s, false) and coalesce(%s, 0) > 0.01',
        v_is_pro_bono, v_receivable
      ) into v_num;
      v_checks := v_checks || jsonb_build_object('pro_bono_com_saldo', v_num);
    exception when others then
      v_checks := v_checks || jsonb_build_object('pro_bono_com_saldo', 'ERRO: ' || sqlerrm);
    end;
  end if;

  -- -------------------------------------------------------------------------
  -- 7) Contrato sem número de contrato preenchido
  -- -------------------------------------------------------------------------
  if v_contract_number is null then
    v_checks := v_checks || jsonb_build_object('contratos_sem_numero', 'sem coluna de número');
  else
    begin
      execute format(
        'select count(*) from public.contracts where %s is null or btrim(%s::text) = ''''',
        v_contract_number, v_contract_number
      ) into v_num;
      v_checks := v_checks || jsonb_build_object('contratos_sem_numero', v_num);
    exception when others then
      v_checks := v_checks || jsonb_build_object('contratos_sem_numero', 'ERRO: ' || sqlerrm);
    end;
  end if;

  -- -------------------------------------------------------------------------
  -- 8) contract_diseases sem coluna environment
  -- -------------------------------------------------------------------------
  begin
    if to_regclass('public.contract_diseases') is null then
      v_checks := v_checks || jsonb_build_object('contract_diseases_sem_environment', 'tabela inexistente');
    elsif not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'contract_diseases' and column_name = 'environment'
    ) then
      execute 'select count(*) from public.contract_diseases' into v_num;
      v_checks := v_checks || jsonb_build_object('contract_diseases_sem_environment', v_num);
    else
      v_checks := v_checks || jsonb_build_object('contract_diseases_sem_environment', 0);
    end if;
  exception when others then
    v_checks := v_checks || jsonb_build_object('contract_diseases_sem_environment', 'ERRO: ' || sqlerrm);
  end;

  -- -------------------------------------------------------------------------
  -- 9) Pagamentos sem conta (type = 'payment')
  -- -------------------------------------------------------------------------
  begin
    execute $q$
      select count(*) from public.payments
       where lower(coalesce(type, '')) = 'payment' and account_id is null
    $q$ into v_num;
    v_checks := v_checks || jsonb_build_object('pagamentos_sem_conta', v_num);
  exception when others then
    v_checks := v_checks || jsonb_build_object('pagamentos_sem_conta', 'ERRO: ' || sqlerrm);
  end;

  -- -------------------------------------------------------------------------
  -- 10) Totais denormalizados inconsistentes
  -- -------------------------------------------------------------------------
  if v_receivable is null or v_contract_value is null or v_paid is null then
    v_checks := v_checks || jsonb_build_object('totais_inconsistentes', 'sem colunas necessárias');
  else
    begin
      execute format(
        'select count(*) from public.contracts c
          where abs(coalesce(c.%s, 0) - greatest(0, coalesce(c.%s, 0) -
                coalesce((select sum(i.%s) from public.installments i where i.contract_id = c.id), 0))) > 0.01',
        v_receivable, v_contract_value, v_paid
      ) into v_num;
      v_checks := v_checks || jsonb_build_object('totais_inconsistentes', v_num);
    exception when others then
      v_checks := v_checks || jsonb_build_object('totais_inconsistentes', 'ERRO: ' || sqlerrm);
    end;
  end if;

  perform set_config('diag.consistencia', v_checks::text, true);

  -- -------------------------------------------------------------------------
  -- 11) Tabela de migrations versionadas
  -- -------------------------------------------------------------------------
  begin
    execute 'select count(*) from public.schema_migrations' into v_num;
    perform set_config('diag.migracoes', jsonb_build_object('existe', true, 'total', v_num)::text, true);
  exception when undefined_table then
    perform set_config('diag.migracoes', jsonb_build_object('existe', false, 'total', null)::text, true);
  when others then
    perform set_config('diag.migracoes', jsonb_build_object('existe', 'erro', 'detalhe', sqlerrm)::text, true);
  end;
end $$;

-- Saída única.
select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'pg_version', current_setting('server_version'),
  'database', current_database(),
  'ambiente_app', current_setting('app.current_env', true),

  'migracoes', current_setting('diag.migracoes')::jsonb,

  'tabelas', (
    select jsonb_object_agg(t, to_regclass('public.' || t) is not null)
      from unnest(array[
        'contracts', 'installments', 'payments', 'installment_history',
        'commission_payments', 'financial_transactions', 'bank_accounts',
        'contract_diseases', 'product_diseases', 'diseases',
        'clients', 'products', 'indicators', 'processes',
        'users', 'audit_logs', 'system_settings',
        'sales', 'financial_records'
      ]) as t
  ),

  'colunas_presentes', jsonb_build_object(
    'payments_id_tipo', (
      select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'payments' and column_name = 'id'
    ),
    'payments_payment_date_tipo', (
      select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'payments' and column_name = 'payment_date'
    ),
    'payments_tem_user_id', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'payments' and column_name = 'user_id'
    ),
    'payments_tem_created_by', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'payments' and column_name = 'created_by'
    ),
    'payments_tem_financial_transaction_id', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'payments' and column_name = 'financial_transaction_id'
    ),
    'payments_tem_payment_method', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'payments' and column_name = 'payment_method'
    ),
    'contracts_tem_base_comissao', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'contracts' and column_name = 'base_comissao'
    ),
    'contracts_tem_contract_number', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'contracts'
         and column_name in ('contractNumber', 'contract_number')
    ),
    'contracts_tem_client_id', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'contracts'
         and column_name in ('client_id', 'clientId')
    ),
    'installments_tem_original_due_date', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'installments' and column_name = 'original_due_date'
    ),
    'installments_due_date_tipo', (
      select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'installments' and column_name = 'dueDate'
    ),
    'contract_diseases_tem_environment', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'contract_diseases' and column_name = 'environment'
    ),
    'tabelas_sem_environment', (
      select jsonb_agg(t order by t)
        from unnest(array[
          'contracts','installments','payments','installment_history',
          'commission_payments','financial_transactions','contract_diseases',
          'product_diseases','audit_logs'
        ]) t
       where not exists (
         select 1 from information_schema.columns c
          where c.table_schema = 'public' and c.table_name = t and c.column_name = 'environment'
       )
    )
  ),

  'constraints', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', cl.relname,
             'nome', c.conname,
             'tipo', c.contype,
             'definicao', left(pg_get_constraintdef(c.oid), 320),
             'validada', c.convalidated
           ) order by cl.relname, c.conname)
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where n.nspname = 'public'
       and cl.relname = any(array[
         'contracts','installments','payments','commission_payments',
         'clients','processes','system_settings','contract_diseases',
         'product_diseases','financial_transactions'
       ])
       and c.contype in ('p', 'u', 'c', 'f')
  ), '[]'::jsonb),

  'indices', coalesce((
    select jsonb_agg(jsonb_build_object('tabela', tablename, 'indice', indexname, 'definicao', indexdef)
           order by tablename, indexname)
      from pg_indexes
     where schemaname = 'public'
       and tablename = any(array[
         'contracts','installments','payments','commission_payments',
         'installment_history','financial_transactions','contract_diseases',
         'product_diseases','audit_logs'
       ])
  ), '[]'::jsonb),

  'functions', coalesce((
    select jsonb_agg(jsonb_build_object(
             'funcao', p.oid::regprocedure::text,
             'volatilidade', case p.provolatile when 's' then 'STABLE'
                                                when 'i' then 'IMMUTABLE'
                                                else 'VOLATILE' end,
             'security_definer', p.prosecdef,
             'search_path', p.proconfig,
             'src_bytes', length(p.prosrc),
             'marcadores', jsonb_build_object(
               'v_has_payments', position('v_has_payments' in p.prosrc) > 0,
               'base_comissao', position('base_comissao' in p.prosrc) > 0,
               'contractNumber', position('contractNumber' in p.prosrc) > 0
                                 or position('contract_number' in p.prosrc) > 0,
               'financial_transaction_id', position('financial_transaction_id' in p.prosrc) > 0,
               'payment_method', position('payment_method' in p.prosrc) > 0,
               'raise_exception', position('RAISE EXCEPTION' in p.prosrc) > 0
             )
           ) order by p.proname, p.oid::regprocedure::text)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = any(array[
         'process_installment_payment', 'process_installment_estorno',
         'process_contract_cancellation', 'prevent_update_delete_paid_contract',
         'prevent_update_delete_paid_installment', 'fn_protect_contracts_status',
         'fn_recalculate_contract_totals', 'get_future_receivables_projection',
         'get_clients_with_process_summary', 'search_all', 'log_audit_event',
         'set_app_environment', 'rpc_receber_parcela_com_metodo',
         'rpc_recebimento_com_desdobramento', 'app_register_commission_payment'
       ])
  ), '[]'::jsonb),

  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', tgrelid::regclass::text,
             'trigger', tgname,
             'funcao', tgfoid::regprocedure::text,
             'tipo_codigo', tgtype,
             'habilitado', tgenabled,
             'definicao', left(pg_get_triggerdef(t.oid), 500)
           ) order by tgrelid::regclass::text, tgname)
      from pg_trigger t
      join pg_class cl on cl.oid = t.tgrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where not t.tgisinternal
       and n.nspname = 'public'
       and cl.relname = any(array['contracts','installments','payments','commission_payments'])
  ), '[]'::jsonb),

  'policies', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', tablename,
             'policy', policyname,
             'permissiva', permissive,
             'comando', cmd,
             'roles', roles,
             'using', left(coalesce(qual::text, '-'), 300),
             'with_check', left(coalesce(with_check::text, '-'), 300)
           ) order by tablename, policyname)
      from pg_policies
     where schemaname = 'public'
       and tablename = any(array[
         'contracts','installments','payments','installment_history',
         'commission_payments','financial_transactions','contract_diseases',
         'audit_logs','system_settings'
       ])
  ), '[]'::jsonb),

  'views', coalesce((
    select jsonb_agg(jsonb_build_object(
             'view', v.viewname,
             'existe', true,
             'opcoes', c.reloptions,
             'definicao', left(v.definition, 1200)
           ) order by v.viewname)
      from pg_views v
      join pg_class c on c.relname = v.viewname and c.relnamespace = v.schemaname::regnamespace
     where v.schemaname = 'public'
       and v.viewname = any(array[
         'contract_receivables_summary', 'vw_indicator_commission_status',
         'vw_portal_commission_details', 'vw_dashboard_receivables_metrics',
         'vw_dashboard_receivables_forecast', 'vw_dashboard_top_defaulters',
         'vw_process_velocity', 'vw_cash_flow_forecast', 'vw_area_efficiency'
       ])
  ), '[]'::jsonb),

  'views_ausentes', (
    select jsonb_agg(v order by v)
      from unnest(array[
        'contract_receivables_summary','vw_indicator_commission_status',
        'vw_portal_commission_details','vw_dashboard_receivables_metrics',
        'vw_dashboard_receivables_forecast','vw_dashboard_top_defaulters',
        'vw_process_velocity','vw_cash_flow_forecast','vw_area_efficiency'
      ]) v
     where to_regclass('public.' || v) is null
  ),

  'permissoes_tabelas', (
    select jsonb_agg(jsonb_build_object(
             'tabela', t,
             'anon_select', has_table_privilege('anon', 'public.' || t, 'SELECT'),
             'anon_insert', has_table_privilege('anon', 'public.' || t, 'INSERT'),
             'authenticated_select', has_table_privilege('authenticated', 'public.' || t, 'SELECT'),
             'authenticated_insert', has_table_privilege('authenticated', 'public.' || t, 'INSERT')
           ) order by t)
      from unnest(array[
        'contracts','installments','payments','commission_payments',
        'audit_logs','system_settings','contract_diseases'
      ]) t
  ),

  'permissoes_functions', coalesce((
    select jsonb_agg(jsonb_build_object(
             'funcao', p.oid::regprocedure::text,
             'anon', has_function_privilege('anon', p.oid::regprocedure::text, 'EXECUTE'),
             'authenticated', has_function_privilege('authenticated', p.oid::regprocedure::text, 'EXECUTE'),
             'public', p.proacl is null or exists (
               select 1 from aclexplode(p.proacl) a
                where a.grantee = 0 and a.privilege_type = 'EXECUTE'
             )
           ) order by p.proname, p.oid::regprocedure::text)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = any(array[
         'exec_sql','process_installment_payment','process_installment_estorno',
         'process_contract_cancellation','rpc_receber_parcela_com_metodo',
         'get_future_receivables_projection','search_all','log_audit_event'
       ])
  ), '[]'::jsonb),

  'definicoes_parciais', jsonb_build_object(
    'process_contract_cancellation', (
      select left(pg_get_functiondef(p.oid), 1400)
        from pg_proc p
       where p.oid = to_regprocedure('public.process_contract_cancellation(bigint,text,bigint)')
    ),
    'process_installment_payment', (
      select left(pg_get_functiondef(p.oid), 1400)
        from pg_proc p
       where p.oid = to_regprocedure('public.process_installment_payment(bigint,numeric,bigint,bigint,text)')
          or p.proname = 'process_installment_payment'
       order by p.oid
       limit 1
    ),
    'log_audit_event', (
      select left(pg_get_functiondef(p.oid), 1400)
        from pg_proc p
       where p.proname = 'log_audit_event'
       order by p.oid
       limit 1
    ),
    'get_future_receivables_projection', (
      select left(pg_get_functiondef(p.oid), 1400)
        from pg_proc p
       where p.proname = 'get_future_receivables_projection'
       order by p.oid
       limit 1
    )
  ),

  'consistencia', current_setting('diag.consistencia')::jsonb
)) as diagnostico_contratos;

rollback;

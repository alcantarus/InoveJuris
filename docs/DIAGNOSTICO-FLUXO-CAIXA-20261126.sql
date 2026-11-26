-- DIAGNOSTICO FORENSE — Módulo Fluxo de Caixa
-- 26/11/2026
--
-- Mesma rotina aplicada em Contratos (24/11) e Contas a Receber (25-26/11):
-- Uma única célula (`diagnostico_fluxo_caixa_20261126`), somente leitura,
-- termina em ROLLBACK. Nenhum UPDATE/DELETE em dados de negocio.
--
-- REGRA PERMANENTE: um unico banco (PostgreSQL 17.6). `production` e `test`
-- sao valores da coluna `environment`, nao bancos separados. Toda secao
-- declara o ambiente consultado ou devolve o ambiente no resultado.
-- Ver docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Objetivo: medir saude do modulo antes de decidir qualquer correcao.
-- Areas cobertas:
--   1. catalogo real de colunas (baseline do repo pode estar defasado);
--   2. constraints, indices, triggers e definicoes de funcoes RPC;
--   3. RLS/policies das tabelas financeiras;
--   4. view vw_cash_flow_forecast (environment, security_invoker, numeros);
--   5. contagens e valores por ambiente;
--   6. saldo persistido x saldo recalculado por conta;
--   7. integridade de lancamentos e duplicatas;
--   8. vinculos de pagamentos/estornos com o caixa;
--   9. chamadas reais das RPCs de caixa e Projecao 30 dias;
--  10. sinais de risco ja identificados no codigo, confirmados ou nao no banco.
--
-- O usuario executa e cola a celula de resultado. Nada e alterado.

begin;

create temp table diag_caixa_blocos (
  bloco    text primary key,
  conteudo jsonb not null
) on commit drop;

do $diag$
declare
  v_tabelas  text[] := array[
    'bank_accounts', 'financial_categories', 'financial_transactions',
    'payments', 'installments'
  ];
  v_funcoes  text[] := array[
    'update_account_balance', 'get_financial_summary',
    'get_financial_chart_data', 'get_future_receivables_projection',
    'rpc_receber_parcela_com_metodo', 'process_installment_payment',
    'process_installment_estorno'
  ];
  v_views    text[] := array[
    'vw_cash_flow_forecast', 'vw_dashboard_receivables_forecast',
    'vw_dashboard_receivables_metrics', 'vw_dashboard_top_defaulters'
  ];
  v_ambientes text[] := array['production', 'test'];
  v_env      text;
  v_t        text;
  v_json     jsonb;
  v_json2    jsonb;
  v_linha    jsonb;
  v_ini      date := date_trunc('month', current_date)::date;
  v_fim      date := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
begin

  insert into diag_caixa_blocos (bloco, conteudo)
  values ('aviso', jsonb_build_object(
    'diagnostico', 'diagnostico_fluxo_caixa_20261126',
    'coletado_em', now(),
    'pg_version', current_setting('server_version'),
    'banco_unico', 'production e test sao valores da coluna environment, nao bancos separados.',
    'ambientes_consultados', to_jsonb(v_ambientes),
    'aviso', 'Somente leitura; nenhuma linha de negocio alterada. Termina em ROLLBACK.',
    'periodo_mes_atual', jsonb_build_object('inicio', v_ini, 'fim', v_fim),
    'proposito', 'Medicao previa para decidir se ha correcao estrutural/de dados. Nao aplicar nada sem autorizacao explicita.'
  ));

  -- 1) Catalogo real de colunas ---------------------------------------------
  select jsonb_object_agg(t, case
           when to_regclass('public.' || t) is null then jsonb_build_object('existe', false)
           else jsonb_build_object(
             'existe', true,
             'colunas', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'coluna', column_name,
                        'tipo', data_type,
                        'nulo', is_nullable
                      ) order by ordinal_position)
                 from information_schema.columns
                where table_schema = 'public' and table_name = t
             ), '[]'::jsonb)
           )
         end)
    into v_json
    from unnest(v_tabelas) as t;

  with colunas as (
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
  ), verificadas (chave, tabela, coluna) as (
    values
      ('financial_transactions.environment','financial_transactions','environment'),
      ('financial_transactions.date','financial_transactions','date'),
      ('financial_transactions.amount','financial_transactions','amount'),
      ('financial_transactions.type','financial_transactions','type'),
      ('financial_transactions.account_id','financial_transactions','account_id'),
      ('financial_transactions.destination_account_id','financial_transactions','destination_account_id'),
      ('financial_transactions.category_id','financial_transactions','category_id'),
      ('financial_transactions.payment_method','financial_transactions','payment_method'),
      ('bank_accounts.environment','bank_accounts','environment'),
      ('bank_accounts.initial_balance','bank_accounts','initial_balance'),
      ('bank_accounts.current_balance','bank_accounts','current_balance'),
      ('financial_categories.environment','financial_categories','environment'),
      ('financial_categories.type','financial_categories','type'),
      ('payments.environment','payments','environment'),
      ('payments.financial_transaction_id','payments','financial_transaction_id'),
      ('payments.reverses_payment_id','payments','reverses_payment_id'),
      ('payments.payment_method','payments','payment_method'),
      ('installments.type','installments','type'),
      ('installments.original_due_date','installments','original_due_date')
  )
  select jsonb_object_agg(v.chave, e.existe)
    into v_json2
    from verificadas v
    cross join lateral (
      select exists(
        select 1 from colunas c
         where c.table_name = v.tabela and c.column_name = v.coluna
      ) as existe
    ) e;

  v_json := coalesce(v_json, '{}'::jsonb) || jsonb_build_object(
    'colunas_chave', coalesce(v_json2, '{}'::jsonb),
    'schema_migrations_existe', to_regclass('public.schema_migrations') is not null
  );

  insert into diag_caixa_blocos (bloco, conteudo) values ('catalogo', v_json);

  -- 2) Constraints, indices, triggers, funcoes e views ----------------------
  select jsonb_object_agg(t, coalesce((
           select jsonb_agg(jsonb_build_object(
                    'nome', conname,
                    'tipo', contype,
                    'definicao', pg_get_constraintdef(c.oid)
                  ) order by conname)
             from pg_constraint c
            where c.conrelid = to_regclass('public.' || t)
         ), '[]'::jsonb))
    into v_json
    from unnest(v_tabelas) as t;

  v_json2 := (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nome', i.indexname, 'definicao', i.indexdef
           ) order by i.indexname), '[]'::jsonb)
      from pg_indexes i
     where i.schemaname = 'public' and i.tablename = any(v_tabelas)
  );

  v_json := v_json || jsonb_build_object('indices', coalesce(v_json2, '[]'::jsonb));

  v_json2 := (
    select coalesce(jsonb_agg(jsonb_build_object(
             'nome', g.tgname,
             'definicao', pg_get_triggerdef(g.oid),
             'desativado', g.tgenabled = 'D'
           ) order by g.tgname), '[]'::jsonb)
      from pg_trigger g
     where g.tgrelid = to_regclass('public.financial_transactions')
       and not g.tgisinternal
  );

  v_json := v_json || jsonb_build_object(
    'triggers_financial_transactions', coalesce(v_json2, '[]'::jsonb)
  );

  select jsonb_object_agg(n, coalesce((
           select jsonb_agg(jsonb_build_object(
                    'args', pg_get_function_identity_arguments(p.oid),
                    'retorno', pg_get_function_result(p.oid),
                    'security_definer', p.prosecdef,
                    'config', p.proconfig,
                    'anon_executa', case when to_regrole('anon') is null then null
                                         else has_function_privilege('anon', p.oid, 'EXECUTE') end,
                    'authenticated_executa', case when to_regrole('authenticated') is null then null
                                                  else has_function_privilege('authenticated', p.oid, 'EXECUTE') end,
                    'definicao', case when p.proname in (
                      'update_account_balance','get_financial_summary',
                      'get_financial_chart_data','get_future_receivables_projection'
                    ) then pg_get_functiondef(p.oid) else null end
                  ) order by pg_get_function_identity_arguments(p.oid))
             from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname = n
         ), '[]'::jsonb))
    into v_json2
    from unnest(v_funcoes) as n;

  v_json := v_json || jsonb_build_object(
    'funcoes', coalesce(v_json2, '{}'::jsonb)
  );

  select jsonb_object_agg(n, case
           when to_regclass('public.' || n) is null then jsonb_build_object('existe', false)
           else jsonb_build_object(
             'existe', true,
             'reloptions', coalesce((
               select array_to_string(c.reloptions, ',')
                 from pg_class c where c.oid = to_regclass('public.' || n)
             ), ''),
             'security_invoker_on', coalesce((
               select array_to_string(c.reloptions, ',')
                 from pg_class c where c.oid = to_regclass('public.' || n)
             ), '') ilike '%security_invoker=on%',
             'colunas', coalesce((
               select jsonb_agg(column_name order by ordinal_position)
                 from information_schema.columns
                where table_schema = 'public' and table_name = n
             ), '[]'::jsonb),
             'definicao', pg_get_viewdef(to_regclass('public.' || n), true)
           )
         end)
    into v_json2
    from unnest(v_views) as n;

  v_json := v_json || jsonb_build_object('views', coalesce(v_json2, '{}'::jsonb));

  insert into diag_caixa_blocos (bloco, conteudo) values ('estrutura', v_json);

  -- 3) RLS e policies -------------------------------------------------------
  select jsonb_object_agg(t, jsonb_build_object(
           'rls_ativo', coalesce((
             select c.relrowsecurity from pg_class c
              where c.oid = to_regclass('public.' || t)
           ), false),
           'policies', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'nome', p.policyname,
                      'comando', p.cmd,
                      'permissiva', p.permissive::text = 'r',
                      'usuarios', p.roles::text[],
                      'using', p.qual,
                      'check', p.with_check
                    ) order by p.policyname)
               from pg_policies p
              where p.schemaname = 'public' and p.tablename = t
           ), '[]'::jsonb)
         ))
    into v_json
    from unnest(v_tabelas) as t;

  insert into diag_caixa_blocos (bloco, conteudo)
  values ('rls', coalesce(v_json, '{}'::jsonb));

  -- 4) Contagens e valores por ambiente -------------------------------------
  with env as (
    select unnest(v_ambientes) as environment
  ), ft as (
    select environment,
           count(*) as n,
           count(*) filter (where lower(btrim(coalesce(type,''))) = 'income') as n_in,
           count(*) filter (where lower(btrim(coalesce(type,''))) = 'expense') as n_out,
           count(*) filter (where lower(btrim(coalesce(type,''))) = 'transfer') as n_transf,
           coalesce(sum(amount) filter (where lower(btrim(coalesce(type,''))) = 'income'), 0) as v_in,
           coalesce(sum(amount) filter (where lower(btrim(coalesce(type,''))) = 'expense'), 0) as v_out,
           coalesce(sum(amount) filter (where lower(btrim(coalesce(type,''))) = 'transfer'), 0) as v_transf,
           count(*) filter (where date >= v_ini and date <= v_fim) as n_mes
      from public.financial_transactions
     group by environment
  ), ba as (
    select environment, count(*) as n,
           coalesce(sum(current_balance), 0) as saldo,
           coalesce(sum(initial_balance), 0) as inicial
      from public.bank_accounts group by environment
  ), fc as (
    select environment, count(*) as n from public.financial_categories group by environment
  ), pa as (
    select environment,
           count(*) as n,
           count(*) filter (where lower(btrim(coalesce(type,''))) = 'payment') as n_pag,
           count(*) filter (where lower(btrim(coalesce(type,''))) = 'reversal') as n_est,
           coalesce(sum(amount) filter (where lower(btrim(coalesce(type,''))) = 'payment'), 0) as v_pag
      from public.payments group by environment
  ), ins as (
    select environment, count(*) as n,
           count(*) filter (where lower(btrim(coalesce(status,''))) = 'estornado') as n_estornado
      from public.installments group by environment
  )
  select jsonb_object_agg(env.environment, jsonb_build_object(
           'transacoes', coalesce(ft.n, 0),
           'lancamentos_income', coalesce(ft.n_in, 0),
           'lancamentos_expense', coalesce(ft.n_out, 0),
           'lancamentos_transfer', coalesce(ft.n_transf, 0),
           'valor_income', coalesce(ft.v_in, 0),
           'valor_expense', coalesce(ft.v_out, 0),
           'valor_transfer', coalesce(ft.v_transf, 0),
           'transacoes_mes_atual', coalesce(ft.n_mes, 0),
           'mes_atual_excede_limite_100_do_front', coalesce(ft.n_mes, 0) > 100,
           'contas', coalesce(ba.n, 0),
           'saldo_persistido', coalesce(ba.saldo, 0),
           'saldo_inicial', coalesce(ba.inicial, 0),
           'categorias', coalesce(fc.n, 0),
           'pagamentos', coalesce(pa.n, 0),
           'pagamentos_tipo_payment', coalesce(pa.n_pag, 0),
           'pagamentos_tipo_reversal', coalesce(pa.n_est, 0),
           'valor_pagamentos', coalesce(pa.v_pag, 0),
           'parcelas', coalesce(ins.n, 0),
           'parcelas_estornadas', coalesce(ins.n_estornado, 0)
         ))
    into v_json
    from env
    left join ft on ft.environment = env.environment
    left join ba on ba.environment = env.environment
    left join fc on fc.environment = env.environment
    left join pa on pa.environment = env.environment
    left join ins on ins.environment = env.environment;

  insert into diag_caixa_blocos (bloco, conteudo)
  values ('por_ambiente', coalesce(v_json, '{}'::jsonb));

  -- 5) Saldo persistido x saldo recalculado ---------------------------------
  with saldo as (
    select a.id as account_id,
           a.environment,
           a.name,
           a.initial_balance,
           a.current_balance,
           a.initial_balance
             + coalesce((select sum(f.amount) from public.financial_transactions f
                          where f.account_id = a.id
                            and lower(btrim(coalesce(f.type,''))) = 'income'), 0)
             - coalesce((select sum(f.amount) from public.financial_transactions f
                          where f.account_id = a.id
                            and lower(btrim(coalesce(f.type,''))) = 'expense'), 0)
             - coalesce((select sum(f.amount) from public.financial_transactions f
                          where f.account_id = a.id
                            and lower(btrim(coalesce(f.type,''))) = 'transfer'), 0)
             + coalesce((select sum(f.amount) from public.financial_transactions f
                          where f.destination_account_id = a.id
                            and lower(btrim(coalesce(f.type,''))) = 'transfer'), 0) as saldo_calculado
      from public.bank_accounts a
  )
  select jsonb_build_object(
           'contas', count(*),
           'contas_divergentes', count(*) filter (where abs(current_balance - saldo_calculado) > 0.01),
           'delta_total', coalesce(sum(current_balance - saldo_calculado), 0),
           'por_ambiente', coalesce((
             select jsonb_object_agg(q.environment, q.detalhe)
               from (
                 select s.environment,
                        jsonb_build_object(
                          'contas', count(*),
                          'divergentes', count(*) filter (
                            where abs(s.current_balance - s.saldo_calculado) > 0.01
                          ),
                          'delta', coalesce(sum(s.current_balance - s.saldo_calculado), 0)
                        ) as detalhe
                   from saldo s
                  group by s.environment
               ) q
           ), '{}'::jsonb),
           'detalhe_divergentes', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'environment', environment,
                      'account_id', account_id,
                      'conta', name,
                      'persistido', current_balance,
                      'calculado', saldo_calculado,
                      'delta', current_balance - saldo_calculado
                    ) order by environment, account_id)
               from saldo
              where abs(current_balance - saldo_calculado) > 0.01
           ), '[]'::jsonb)
         )
    into v_json
    from saldo;

  insert into diag_caixa_blocos (bloco, conteudo)
  values ('saldo', coalesce(v_json, '{}'::jsonb));

  -- 6) Integridade de lancamentos -------------------------------------------
  select jsonb_build_object(
    'transacoes_valor_nao_positivo', (
      select count(*) from public.financial_transactions where coalesce(amount, 0) <= 0
    ),
    'transacoes_sem_conta', (
      select count(*) from public.financial_transactions where account_id is null
    ),
    'transacoes_sem_categoria', (
      select count(*) from public.financial_transactions where category_id is null
    ),
    'transacoes_tipo_fora_do_padrao', (
      select count(*) from public.financial_transactions
       where lower(btrim(coalesce(type,''))) not in ('income','expense','transfer')
    ),
    'transferencias_sem_conta_destino', (
      select count(*) from public.financial_transactions
       where lower(btrim(coalesce(type,''))) = 'transfer' and destination_account_id is null
    ),
    'nao_transferencia_com_conta_destino', (
      select count(*) from public.financial_transactions
       where lower(btrim(coalesce(type,''))) <> 'transfer' and destination_account_id is not null
    ),
    'transferencia_origem_igual_destino', (
      select count(*) from public.financial_transactions
       where destination_account_id is not null and destination_account_id = account_id
    ),
    'transacoes_environment_nulo', (
      select count(*) from public.financial_transactions where environment is null
    ),
    'transacoes_environment_fora_padrao', (
      select count(*) from public.financial_transactions
       where environment is null or btrim(environment) not in ('production','test')
    ),
    'transacoes_data_futura_30d', (
      select count(*) from public.financial_transactions where date > current_date + 30
    ),
    'grupos_duplicados', (
      select count(*) from (
        select 1 from public.financial_transactions
         group by environment, account_id, date, amount,
                  lower(btrim(coalesce(type,''))), coalesce(description,'')
        having count(*) > 1
      ) d
    ),
    'linhas_em_grupos_duplicados', (
      select coalesce(sum(n), 0) from (
        select count(*) n from public.financial_transactions
         group by environment, account_id, date, amount,
                  lower(btrim(coalesce(type,''))), coalesce(description,'')
        having count(*) > 1
      ) d
    ),
    'contas_duplicadas_por_nome_ambiente', (
      select count(*) from (
        select 1 from public.bank_accounts
         group by environment, lower(btrim(coalesce(name,'')))
        having count(*) > 1
      ) d
    ),
    'categorias_duplicadas_por_nome_tipo_ambiente', (
      select count(*) from (
        select 1 from public.financial_categories
         group by environment, lower(btrim(coalesce(type,''))), lower(btrim(coalesce(name,'')))
        having count(*) > 1
      ) d
    ),
    'transacoes_conta_de_ambiente_diferente', (
      select count(*) from public.financial_transactions f
        join public.bank_accounts a on a.id = f.account_id
       where f.environment is distinct from a.environment
    ),
    'transacoes_categoria_de_ambiente_diferente', (
      select count(*) from public.financial_transactions f
        join public.financial_categories c on c.id = f.category_id
       where f.environment is distinct from c.environment
    ),
    'transacoes_destino_de_ambiente_diferente', (
      select count(*) from public.financial_transactions f
        join public.bank_accounts a on a.id = f.destination_account_id
       where f.environment is distinct from a.environment
    )
  ) into v_json;

  insert into diag_caixa_blocos (bloco, conteudo)
  values ('integridade', coalesce(v_json, '{}'::jsonb));

  -- 7) Pagamentos e estornos x caixa ----------------------------------------
  select jsonb_build_object(
    'pagamentos_sem_transacao_vinculada', (
      select count(*) from public.payments where financial_transaction_id is null
    ),
    'pagamentos_com_transacao_vinculada', (
      select count(*) from public.payments where financial_transaction_id is not null
    ),
    'pagamento_transacao_de_ambiente_diferente', (
      select count(*) from public.payments p
        join public.financial_transactions f on f.id = p.financial_transaction_id
       where p.environment is distinct from f.environment
    ),
    'pagamento_conta_de_ambiente_diferente', (
      select count(*) from public.payments p
        join public.bank_accounts a on a.id = p.account_id
       where p.environment is distinct from a.environment
    ),
    'reversoes', (
      select count(*) from public.payments
       where lower(btrim(coalesce(type,''))) = 'reversal'
    ),
    'reversoes_sem_vinculo', (
      select count(*) from public.payments
       where lower(btrim(coalesce(type,''))) = 'reversal'
         and reverses_payment_id is null
    ),
    'reversoes_com_vinculo', (
      select count(*) from public.payments
       where lower(btrim(coalesce(type,''))) = 'reversal'
         and reverses_payment_id is not null
    ),
    'pagamentos_valor_nao_positivo', (
      select count(*) from public.payments where coalesce(amount, 0) <= 0
    ),
    'parcelas_amountpaid_diferente_soma_pagamentos', (
      select count(*) from (
        select i.id,
               i."amountPaid",
               coalesce(sum(p.amount) filter (
                 where lower(btrim(coalesce(p.type,''))) = 'payment'
               ), 0) as soma
          from public.installments i
          left join public.payments p on p.installment_id = i.id
         group by i.id, i."amountPaid"
        having abs(coalesce(i."amountPaid",0) - coalesce(sum(p.amount) filter (
                 where lower(btrim(coalesce(p.type,''))) = 'payment'
               ), 0)) > 0.01
      ) d
    )
  ) into v_json;

  insert into diag_caixa_blocos (bloco, conteudo)
  values ('pagamentos', coalesce(v_json, '{}'::jsonb));

  -- 8) View de previsao e RPCs em producao ----------------------------------
  v_json := jsonb_build_object('vw_cash_flow_forecast', '{}'::jsonb,
                               'get_financial_summary_mes_atual', '{}'::jsonb,
                               'get_future_receivables_projection', '{}'::jsonb);

  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'vw_cash_flow_forecast'
                and column_name = 'environment')
     and exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'vw_cash_flow_forecast'
                and column_name = 'expected_amount')
  then
    execute 'select coalesce(jsonb_object_agg(environment, jsonb_build_object(''linhas'', n, ''valor_previsto'', vl)), ''{}''::jsonb)'
         || ' from (select environment, count(*) n, coalesce(sum(expected_amount),0) vl'
         || ' from public.vw_cash_flow_forecast where environment is not null group by environment) q'
      into v_json2;
    v_json := jsonb_set(v_json, '{vw_cash_flow_forecast}', coalesce(v_json2, '{}'::jsonb));
  else
    v_json := jsonb_set(v_json, '{vw_cash_flow_forecast}',
      jsonb_build_object('erro', 'view sem environment ou sem expected_amount; nao consultada'));
  end if;

  if to_regprocedure('public.get_financial_summary(date,date,bigint,bigint,text)') is not null then
    v_json2 := '{}'::jsonb;
    foreach v_env in array v_ambientes loop
      execute 'select coalesce(jsonb_object_agg(transaction_type, total_amount), ''{}''::jsonb)'
           || ' from (select * from public.get_financial_summary($1,$2,null,null,$3)) q'
           || ' where transaction_type is not null'
        into v_linha using v_ini, v_fim, v_env;
      v_json2 := v_json2 || jsonb_build_object(v_env, coalesce(v_linha, '{}'::jsonb));
    end loop;
    v_json := jsonb_set(v_json, '{get_financial_summary_mes_atual}', v_json2);
  else
    v_json := jsonb_set(v_json, '{get_financial_summary_mes_atual}',
      jsonb_build_object('erro', 'assinatura esperada nao encontrada'));
  end if;

  if to_regprocedure('public.get_future_receivables_projection(text)') is not null then
    v_json2 := '{}'::jsonb;
    foreach v_env in array v_ambientes loop
      execute 'select coalesce(jsonb_object_agg(due_month, total_amount), ''{}''::jsonb)'
           || ' from public.get_future_receivables_projection($1)'
        into v_linha using v_env;
      v_json2 := v_json2 || jsonb_build_object(v_env, coalesce(v_linha, '{}'::jsonb));
    end loop;
    v_json := jsonb_set(v_json, '{get_future_receivables_projection}', v_json2);
  else
    v_json := jsonb_set(v_json, '{get_future_receivables_projection}',
      jsonb_build_object('erro', 'assinatura (text) nao encontrada'));
  end if;

  insert into diag_caixa_blocos (bloco, conteudo)
  values ('rpc_e_view', coalesce(v_json, '{}'::jsonb));

  -- 9) Sinais de risco do codigo, confirmados no catalogo --------------------
  select jsonb_build_object(
    'frontend_kpi_usado_limite_100', true,
    'triggers_update_balance_em_financial_transactions', (
      select count(*) from pg_trigger g
       where g.tgrelid = to_regclass('public.financial_transactions')
         and not g.tgisinternal
         and g.tgfoid in (
           select p.oid from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname = 'update_account_balance'
         )
    ),
    'update_account_balance_com_assinatura_rpc', exists (
      select 1 from pg_proc p
       where p.pronamespace = 'public'::regnamespace
         and p.proname = 'update_account_balance'
         and pg_get_function_identity_arguments(p.oid) ilike '%acc_id%'
         and pg_get_function_identity_arguments(p.oid) ilike '%amount_change%'
    ),
    'installments_tem_coluna_type', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'installments' and column_name = 'type'
    ),
    'financial_transactions_tem_payment_method', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'financial_transactions'
         and column_name = 'payment_method'
    ),
    'vw_cash_flow_forecast_tem_environment', exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'vw_cash_flow_forecast'
         and column_name = 'environment'
    ),
    'vw_cash_flow_forecast_security_invoker_on', coalesce((
      select array_to_string(c.reloptions, ',') ilike '%security_invoker=on%'
        from pg_class c where c.oid = to_regclass('public.vw_cash_flow_forecast')
    ), false),
    'rls_permissiva_em_tabela_financeira', (
      select count(*) from pg_policies p
       where p.schemaname = 'public'
         and p.tablename = any(v_tabelas)
         and (p.qual is null or btrim(p.qual) = 'true')
    ),
    'nota', 'Sinais do codigo: saldo ajustado por trigger + RPC + UPDATE manual em movimentacoes; KPIs da visao geral limitados a 100 linhas; previstas usam installments.type; RPCs nao passam pelo proxy de environment.'
  ) into v_json;

  insert into diag_caixa_blocos (bloco, conteudo)
  values ('riscos_codigo', coalesce(v_json, '{}'::jsonb));

end
$diag$;

select jsonb_pretty(jsonb_object_agg(bloco, conteudo order by bloco)) as diagnostico_fluxo_caixa_20261126
  from diag_caixa_blocos;

rollback;

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
-- Reescrito sem tabela temporaria e sem bloco DO: tudo e resolvido em uma
-- única consulta com CTEs, para evitar dependencia de estado entre
-- instrucoes no SQL Editor.
--
-- Usuario executa e cola a celula de resultado. Nada e alterado.

begin;

with params as (
  select date_trunc('month', current_date)::date as ini,
         (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date as fim
),
tabelas(tabela) as (
  values ('bank_accounts'), ('financial_categories'), ('financial_transactions'),
         ('payments'), ('installments')
),
funcoes(nome) as (
  values ('update_account_balance'), ('get_financial_summary'),
         ('get_financial_chart_data'), ('get_future_receivables_projection'),
         ('rpc_receber_parcela_com_metodo'), ('process_installment_payment'),
         ('process_installment_estorno')
),
views_analisadas(nome) as (
  values ('vw_cash_flow_forecast'), ('vw_dashboard_receivables_forecast'),
         ('vw_dashboard_receivables_metrics'), ('vw_dashboard_top_defaulters')
),
ambientes(environment) as (
  values ('production'), ('test')
),
colunas as (
  select table_name, column_name, data_type, is_nullable, ordinal_position
    from information_schema.columns
   where table_schema = 'public'
),
catalogo_base as (
  select t.tabela,
         case when to_regclass('public.' || t.tabela) is null
              then jsonb_build_object('existe', false)
              else jsonb_build_object(
                     'existe', true,
                     'colunas', coalesce((
                       select jsonb_agg(jsonb_build_object(
                                'coluna', c.column_name,
                                'tipo', c.data_type,
                                'nulo', c.is_nullable
                              ) order by c.ordinal_position)
                         from colunas c where c.table_name = t.tabela
                     ), '[]'::jsonb)
                   )
         end as detalhe
    from tabelas t
),
catalogo as (
  select jsonb_object_agg(tabela, detalhe) as valor from catalogo_base
),
colunas_chave_base(chave, tabela, coluna) as (
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
),
colunas_chave as (
  select jsonb_object_agg(x.chave, e.existe) as valor
    from colunas_chave_base x
    cross join lateral (
      select exists(
        select 1 from colunas c
         where c.table_name = x.tabela and c.column_name = x.coluna
      ) as existe
    ) e
),
restricoes as (
  select jsonb_object_agg(t.tabela, coalesce((
           select jsonb_agg(jsonb_build_object(
                    'nome', k.conname,
                    'tipo', k.contype,
                    'definicao', pg_get_constraintdef(k.oid)
                  ) order by k.conname)
             from pg_constraint k
            where k.conrelid = to_regclass('public.' || t.tabela)
         ), '[]'::jsonb)) as valor
    from tabelas t
),
indices as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'tabela', i.tablename, 'nome', i.indexname, 'definicao', i.indexdef
         ) order by i.tablename, i.indexname), '[]'::jsonb) as valor
    from pg_indexes i
   where i.schemaname = 'public' and i.tablename in (
     select tabela from tabelas
   )
),
triggers_caixa as (
  select coalesce(jsonb_agg(jsonb_build_object(
           'nome', g.tgname,
           'definicao', pg_get_triggerdef(g.oid),
           'desativado', g.tgenabled = 'D'
         ) order by g.tgname), '[]'::jsonb) as valor
    from pg_trigger g
   where g.tgrelid = to_regclass('public.financial_transactions')
     and not g.tgisinternal
),
funcoes_detalhe as (
  select jsonb_object_agg(f.nome, coalesce((
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
            where p.pronamespace = 'public'::regnamespace and p.proname = f.nome
         ), '[]'::jsonb)) as valor
    from funcoes f
),
views_detalhe as (
  select jsonb_object_agg(v.nome, case
           when to_regclass('public.' || v.nome) is null
                then jsonb_build_object('existe', false)
           else jsonb_build_object(
                  'existe', true,
                  'reloptions', coalesce((
                    select array_to_string(c.reloptions, ',')
                      from pg_class c where c.oid = to_regclass('public.' || v.nome)
                  ), ''),
                  'security_invoker_on', coalesce((
                    select array_to_string(c.reloptions, ',')
                      from pg_class c where c.oid = to_regclass('public.' || v.nome)
                  ), '') ilike '%security_invoker=on%',
                  'colunas', coalesce((
                    select jsonb_agg(c.column_name order by c.ordinal_position)
                      from colunas c where c.table_name = v.nome
                  ), '[]'::jsonb),
                  'definicao', pg_get_viewdef(to_regclass('public.' || v.nome), true)
                )
         end) as valor
    from views_analisadas v
),
estrutura as (
  select jsonb_build_object(
           'restricoes', (select valor from restricoes),
           'indices', (select valor from indices),
           'triggers_financial_transactions', (select valor from triggers_caixa),
           'funcoes', (select valor from funcoes_detalhe),
           'views', (select valor from views_detalhe)
         ) as valor
),
rls as (
  select jsonb_object_agg(t.tabela, jsonb_build_object(
           'rls_ativo', coalesce((
             select c.relrowsecurity from pg_class c
              where c.oid = to_regclass('public.' || t.tabela)
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
              where p.schemaname = 'public' and p.tablename = t.tabela
           ), '[]'::jsonb)
         )) as valor
    from tabelas t
),
ft as (
  select f.environment,
         count(*) as n,
         count(*) filter (where lower(btrim(coalesce(f.type,''))) = 'income') as n_in,
         count(*) filter (where lower(btrim(coalesce(f.type,''))) = 'expense') as n_out,
         count(*) filter (where lower(btrim(coalesce(f.type,''))) = 'transfer') as n_transf,
         coalesce(sum(f.amount) filter (where lower(btrim(coalesce(f.type,''))) = 'income'), 0) as v_in,
         coalesce(sum(f.amount) filter (where lower(btrim(coalesce(f.type,''))) = 'expense'), 0) as v_out,
         coalesce(sum(f.amount) filter (where lower(btrim(coalesce(f.type,''))) = 'transfer'), 0) as v_transf,
         count(*) filter (where f.date >= p.ini and f.date <= p.fim) as n_mes
    from public.financial_transactions f
    cross join params p
   group by f.environment, p.ini, p.fim
),
ba as (
  select environment, count(*) as n,
         coalesce(sum(current_balance), 0) as saldo,
         coalesce(sum(initial_balance), 0) as inicial
    from public.bank_accounts group by environment
),
fc as (
  select environment, count(*) as n from public.financial_categories group by environment
),
pa as (
  select environment,
         count(*) as n,
         count(*) filter (where lower(btrim(coalesce(type,''))) = 'payment') as n_pag,
         count(*) filter (where lower(btrim(coalesce(type,''))) = 'reversal') as n_est,
         coalesce(sum(amount) filter (where lower(btrim(coalesce(type,''))) = 'payment'), 0) as v_pag
    from public.payments group by environment
),
ins as (
  select environment, count(*) as n,
         count(*) filter (where lower(btrim(coalesce(status,''))) = 'estornado') as n_estornado
    from public.installments group by environment
),
por_ambiente as (
  select jsonb_object_agg(e.environment, jsonb_build_object(
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
         )) as valor
    from ambientes e
    left join ft on ft.environment = e.environment
    left join ba on ba.environment = e.environment
    left join fc on fc.environment = e.environment
    left join pa on pa.environment = e.environment
    left join ins on ins.environment = e.environment
),
saldo_base as (
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
),
saldo as (
  select jsonb_build_object(
           'contas', count(*),
           'contas_divergentes', count(*) filter (
             where abs(current_balance - saldo_calculado) > 0.01
           ),
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
                   from saldo_base s
                  group by s.environment
               ) q
           ), '{}'::jsonb),
           'detalhe_divergentes', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'environment', s.environment,
                      'account_id', s.account_id,
                      'conta', s.name,
                      'persistido', s.current_balance,
                      'calculado', s.saldo_calculado,
                      'delta', s.current_balance - s.saldo_calculado
                    ) order by s.environment, s.account_id)
               from saldo_base s
              where abs(s.current_balance - s.saldo_calculado) > 0.01
           ), '[]'::jsonb)
         ) as valor
    from saldo_base
),
integridade as (
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
  ) as valor
),
pagamentos as (
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
  ) as valor
),
forecast as (
  select environment, count(*) as n,
         coalesce(sum(expected_amount), 0) as vl
    from public.vw_cash_flow_forecast
   where environment is not null
   group by environment
),
rpc_mes as (
  select e.environment, q.transaction_type, q.total_amount
    from params p
    cross join ambientes e
    cross join lateral public.get_financial_summary(
      p.ini, p.fim, null, null, e.environment
    ) q
),
projecao as (
  select e.environment, q.due_month, q.total_amount
    from ambientes e
    cross join lateral public.get_future_receivables_projection(e.environment) q
),
rpc_e_view as (
  select jsonb_build_object(
    'vw_cash_flow_forecast', coalesce((
      select jsonb_object_agg(environment, jsonb_build_object(
               'linhas', n, 'valor_previsto', vl
             ))
        from forecast
    ), '{}'::jsonb),
    'get_financial_summary_mes_atual', coalesce((
      select jsonb_object_agg(q.environment, q.detalhe)
        from (
          select r.environment,
                 jsonb_object_agg(r.transaction_type, r.total_amount) as detalhe
            from rpc_mes r
           where r.transaction_type is not null
           group by r.environment
        ) q
    ), '{}'::jsonb),
    'get_future_receivables_projection', coalesce((
      select jsonb_object_agg(q.environment, q.detalhe)
        from (
          select pr.environment,
                 jsonb_object_agg(pr.due_month, pr.total_amount) as detalhe
            from projecao pr
           group by pr.environment
        ) q
    ), '{}'::jsonb)
  ) as valor
),
riscos as (
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
      select 1 from colunas c
       where c.table_name = 'installments' and c.column_name = 'type'
    ),
    'financial_transactions_tem_payment_method', exists (
      select 1 from colunas c
       where c.table_name = 'financial_transactions' and c.column_name = 'payment_method'
    ),
    'vw_cash_flow_forecast_tem_environment', exists (
      select 1 from colunas c
       where c.table_name = 'vw_cash_flow_forecast' and c.column_name = 'environment'
    ),
    'vw_cash_flow_forecast_security_invoker_on', coalesce((
      select array_to_string(c.reloptions, ',') ilike '%security_invoker=on%'
        from pg_class c where c.oid = to_regclass('public.vw_cash_flow_forecast')
    ), false),
    'rls_permissiva_em_tabela_financeira', (
      select count(*) from pg_policies p
       where p.schemaname = 'public'
         and p.tablename in (select tabela from tabelas)
         and (p.qual is null or btrim(p.qual) = 'true')
    ),
    'schema_migrations_existe', to_regclass('public.schema_migrations') is not null,
    'nota', 'Sinais do codigo: saldo ajustado por trigger + RPC + UPDATE manual em movimentacoes; KPIs da visao geral limitados a 100 linhas; previstas usam installments.type; RPCs nao passam pelo proxy de environment.'
  ) as valor
)
select jsonb_pretty(jsonb_build_object(
  'aviso', jsonb_build_object(
    'diagnostico', 'diagnostico_fluxo_caixa_20261126',
    'coletado_em', now(),
    'pg_version', current_setting('server_version'),
    'banco_unico', 'production e test sao valores da coluna environment, nao bancos separados.',
    'ambientes_consultados', (select jsonb_agg(environment) from ambientes),
    'aviso', 'Somente leitura; nenhuma linha de negocio alterada. Termina em ROLLBACK.',
    'periodo_mes_atual', jsonb_build_object(
      'inicio', (select ini from params), 'fim', (select fim from params)
    ),
    'proposito', 'Medicao previa para decidir se ha correcao estrutural/de dados. Nao aplicar nada sem autorizacao explicita.'
  ),
  'catalogo', (select valor from catalogo) || jsonb_build_object(
    'colunas_chave', (select valor from colunas_chave),
    'schema_migrations_existe', to_regclass('public.schema_migrations') is not null
  ),
  'estrutura', (select valor from estrutura),
  'rls', (select valor from rls),
  'por_ambiente', (select valor from por_ambiente),
  'saldo', (select valor from saldo),
  'integridade', (select valor from integridade),
  'pagamentos', (select valor from pagamentos),
  'rpc_e_view', (select valor from rpc_e_view),
  'riscos_codigo', (select valor from riscos)
)) as diagnostico_fluxo_caixa_20261126;

rollback;

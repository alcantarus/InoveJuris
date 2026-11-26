-- Forense somente leitura — Módulo Contas a Receber
-- 25/11/2026
--
-- Objetivo: mesma checagem aplicada ontem em Contratos, agora no módulo que a
-- tela de Contas a Receber realmente usa. Mede se os KPIs, a view e os filtros
-- da interface batem com os dados. NÃO corrige nada. Termina em ROLLBACK.
--
-- AMBIENTE (regra permanente): banco único; `environment='production'` é
-- produção e `environment='test'` é homologação, na mesma instância. Este
-- script não filtra por ambiente: a interpretação deve declarar quais rótulos
-- apareceram. Ver docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Fontes de dados da tela (app/contas-a-receber/page.tsx):
--   - view contract_receivables_summary (lista de contratos)
--   - installments (parcelas do contrato)
--   - payments (histórico + KPI "Recebido este Mês")
--   - RPC rpc_receber_parcela_com_metodo e process_installment_estorno
--   - lookups bank_accounts e financial_categories
--
-- Como usar: executar o arquivo inteiro no SQL Editor e copiar a ÚNICA
-- célula `diagnostico_contas_a_receber`.

begin;

select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'pg_version', current_setting('server_version'),

  'aviso', 'Registros abaixo sao CANDIDATOS a divergencia entre a tela e o banco. Nenhuma correcao foi aplicada; todo o script rola para tras no fim.',

  'colunas', (
    select jsonb_object_agg(table_name || '.' || column_name, data_type
                            order by table_name, ordinal_position)
      from information_schema.columns
     where table_schema = 'public'
       and table_name = any(array['payments', 'installments', 'contracts',
                                  'bank_accounts', 'financial_categories',
                                  'financial_transactions'])
  ),

  'chave_estrangeiras', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', tc.table_name,
             'coluna', kcu.column_name,
             'referencia', ccu.table_name || '.' || ccu.column_name,
             'delete_rule', rc.delete_rule
           ) order by tc.table_name, kcu.column_name)
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name
       and kcu.table_schema = tc.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      join information_schema.referential_constraints rc
        on rc.constraint_name = tc.constraint_name
       and rc.constraint_schema = tc.table_schema
     where tc.constraint_type = 'FOREIGN KEY'
       and tc.table_schema = 'public'
       and tc.table_name in ('payments', 'installments', 'contracts')
  ), '[]'::jsonb),

  'view_do_modulo', jsonb_build_object(
    'existe', to_regclass('public.contract_receivables_summary') is not null,
    'colunas', coalesce((
      select jsonb_agg(column_name order by ordinal_position)
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'contract_receivables_summary'
    ), '[]'::jsonb),
    'security_invoker', coalesce((
      select to_jsonb(c.reloptions)
        from pg_class c
       where c.oid = 'public.contract_receivables_summary'::regclass
    ), '[]'::jsonb),
    'definicao', (
      select pg_get_viewdef('public.contract_receivables_summary'::regclass, true)
    ),
    'policies', coalesce((
      select jsonb_agg(jsonb_build_object(
               'policyname', policyname,
               'cmd', cmd,
               'qual', qual,
               'with_check', with_check
             ) order by policyname)
        from pg_policies
       where schemaname = 'public'
         and tablename = 'contract_receivables_summary'
    ), '[]'::jsonb)
  ),

  'rpc_do_modulo', coalesce((
    select jsonb_agg(jsonb_build_object(
             'nome', p.proname,
             'nargs', p.pronargs,
             'resultado', pg_get_function_result(p.oid),
             'execute_authenticated', has_function_privilege('authenticated', p.oid, 'execute'),
             'execute_anon', has_function_privilege('anon', p.oid, 'execute'),
             'execute_service_role', has_function_privilege('service_role', p.oid, 'execute'),
             'definicao',
               case when p.proname in ('rpc_receber_parcela_com_metodo',
                                       'process_installment_estorno')
                    then pg_get_functiondef(p.oid)
                    else 'nao incluida (so existencia e privilegios)'
               end
           ) order by p.proname, p.pronargs)
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('rpc_receber_parcela_com_metodo',
                         'process_installment_estorno',
                         'process_installment_payment',
                         'process_contract_cancellation',
                         'process_sync_status')
  ), '[]'::jsonb),

  'grants_tabelas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', c.relname,
             'authenticated_select', has_table_privilege('authenticated', c.oid, 'SELECT'),
             'anon_select', has_table_privilege('anon', c.oid, 'SELECT'),
             'rls_habilitado', c.relrowsecurity,
             'força_rls', c.relforcerowsecurity
           ) order by c.relname)
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'v', 'm')
       and c.relname in ('payments', 'installments', 'contracts',
                         'contract_receivables_summary', 'bank_accounts',
                         'financial_categories')
  ), '[]'::jsonb),

  'distribuicao_payments', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tipo', coalesce(tipo, 'nulo'),
             'sem_conta', sem_conta,
             'sem_parcela', sem_parcela,
             'total', total
           ) order by tipo, sem_conta, sem_parcela)
      from (
        select lower(coalesce(type, '')) as tipo,
               account_id is null as sem_conta,
               installment_id is null as sem_parcela,
               count(*) as total
          from public.payments
         group by 1, 2, 3
      ) d
  ), '[]'::jsonb),

  -- =====================================================================
  -- KPI 1 — "Recebido este Mês": reproduz a regra do app (lib/payments.ts)
  -- =====================================================================
  'kpi_recebido_mes', jsonb_build_object(
    'inicio_mes', date_trunc('month', now())::date,
    'bruto', coalesce((
      select sum(p.amount)
        from public.payments p
       where p.payment_date >= date_trunc('month', now())
         and p.payment_date <  date_trunc('month', now()) + interval '1 month'
    ), 0),
    'linhas_bruto', (
      select count(*)
        from public.payments p
       where p.payment_date >= date_trunc('month', now())
         and p.payment_date <  date_trunc('month', now()) + interval '1 month'
    ),
    'excluido_por_tipo_reversal', coalesce((
      select sum(p.amount)
        from public.payments p
       where p.payment_date >= date_trunc('month', now())
         and p.payment_date <  date_trunc('month', now()) + interval '1 month'
         and lower(coalesce(p.type, '')) = 'reversal'
    ), 0),
    'excluido_por_descricao_estorno', coalesce((
      select sum(p.amount)
        from public.payments p
       where p.payment_date >= date_trunc('month', now())
         and p.payment_date <  date_trunc('month', now()) + interval '1 month'
         and lower(coalesce(p.type, '')) <> 'reversal'
         and p.description is not null
         and p.description ilike '%estorno%'
    ), 0),
    'excluido_por_estorno_vinculado', coalesce((
      select sum(p.amount)
        from public.payments p
       where p.payment_date >= date_trunc('month', now())
         and p.payment_date <  date_trunc('month', now()) + interval '1 month'
         and lower(coalesce(p.type, '')) <> 'reversal'
         and exists (
               select 1 from public.payments r
                where lower(coalesce(r.type, '')) = 'reversal'
                  and r.reverses_payment_id = p.id
             )
         and not (p.description is not null and p.description ilike '%estorno%')
    ), 0),
    'liquido_que_a_tela_mostra', coalesce((
      select sum(p.amount)
        from public.payments p
       where p.payment_date >= date_trunc('month', now())
         and p.payment_date <  date_trunc('month', now()) + interval '1 month'
         and lower(coalesce(p.type, '')) <> 'reversal'
         and not exists (
               select 1 from public.payments r
                where lower(coalesce(r.type, '')) = 'reversal'
                  and r.reverses_payment_id = p.id
             )
         and (p.description is null or p.description not ilike '%estorno%')
    ), 0),
    'reversao_no_mes_de_pagamento_fora_do_mes', jsonb_build_object(
      'total', coalesce((
        select sum(r.amount)
          from public.payments r
         where r.payment_date >= date_trunc('month', now())
           and r.payment_date <  date_trunc('month', now()) + interval '1 month'
           and lower(coalesce(r.type, '')) = 'reversal'
           and (r.reverses_payment_id is null
                or not exists (
                     select 1 from public.payments p
                      where p.id = r.reverses_payment_id
                        and p.payment_date >= date_trunc('month', now())
                        and p.payment_date <  date_trunc('month', now()) + interval '1 month'
                   ))
      ), 0),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', x.id,
                 'valor', x.amount,
                 'data', x.payment_date,
                 'vinculo', x.reverses_payment_id,
                 'parcela', x.installment_id,
                 'descricao', x.description
               ) order by x.payment_date)
          from (
            select r.id, r.amount, r.payment_date, r.reverses_payment_id,
                   r.installment_id, r.description
              from public.payments r
             where r.payment_date >= date_trunc('month', now())
               and r.payment_date <  date_trunc('month', now()) + interval '1 month'
               and lower(coalesce(r.type, '')) = 'reversal'
               and (r.reverses_payment_id is null
                    or not exists (
                         select 1 from public.payments p
                          where p.id = r.reverses_payment_id
                            and p.payment_date >= date_trunc('month', now())
                            and p.payment_date <  date_trunc('month', now()) + interval '1 month'
                       ))
             order by r.payment_date
             limit 30
          ) x
      ), '[]'::jsonb)
    ),
    'estornos_no_mes_sem_vinculo', jsonb_build_object(
      'total', (
        select count(*)
          from public.payments r
         where r.payment_date >= date_trunc('month', now())
           and r.payment_date <  date_trunc('month', now()) + interval '1 month'
           and lower(coalesce(r.type, '')) = 'reversal'
           and r.reverses_payment_id is null
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', r.id,
                 'valor', r.amount,
                 'data', r.payment_date,
                 'parcela', r.installment_id,
                 'descricao', r.description
               ) order by r.payment_date)
          from (
            select * from public.payments
             where payment_date >= date_trunc('month', now())
               and payment_date <  date_trunc('month', now()) + interval '1 month'
               and lower(coalesce(type, '')) = 'reversal'
               and reverses_payment_id is null
             order by payment_date
             limit 30
          ) r
      ), '[]'::jsonb)
    )
  ),

  -- =====================================================================
  -- KPI 2 — "Previsão (30d)": mesmos filtros da tela
  -- =====================================================================
  'kpi_previsao_30d', jsonb_build_object(
    'soma_saldo', coalesce((
      select sum(i.amount - coalesce(i."amountPaid", 0))
        from public.installments i
       where i."dueDate" >= current_date
         and i."dueDate" <= current_date + 30
         and i.status in ('Aberto', 'Parcial', 'Atrasada', 'Prorrogada')
    ), 0),
    'parcelas', (
      select count(*)
        from public.installments i
       where i."dueDate" >= current_date
         and i."dueDate" <= current_date + 30
         and i.status in ('Aberto', 'Parcial', 'Atrasada', 'Prorrogada')
    ),
    'parcelas_de_contrato_cancelado', (
      select count(*)
        from public.installments i
        join public.contracts c on c.id = i.contract_id
       where i."dueDate" >= current_date
         and i."dueDate" <= current_date + 30
         and i.status in ('Aberto', 'Parcial', 'Atrasada', 'Prorrogada')
         and c.status = 'Cancelado'
    ),
    'parcelas_sem_saldo', (
      select count(*)
        from public.installments i
       where i."dueDate" >= current_date
         and i."dueDate" <= current_date + 30
         and i.status in ('Aberto', 'Parcial', 'Atrasada', 'Prorrogada')
         and i.amount - coalesce(i."amountPaid", 0) <= 0.01
    )
  ),

  -- =====================================================================
  -- Consistência parcela x pagamentos (a base de tudo na tela)
  -- =====================================================================
  'parcela_vs_pagamentos', jsonb_build_object(
    'total_divergente', (
      select count(*)
        from (
          select i.id,
                 coalesce(i."amountPaid", 0) as amount_paid,
                 coalesce(x.soma_pagamentos, 0) as soma_pagamentos,
                 coalesce(x.soma_reversoes, 0) as soma_reversoes,
                 coalesce(x.soma_pagamentos, 0) - coalesce(x.soma_reversoes, 0) as efetivo
            from public.installments i
            left join lateral (
              select sum(case when lower(coalesce(p.type, '')) <> 'reversal'
                              then p.amount else 0 end) as soma_pagamentos,
                     sum(case when lower(coalesce(p.type, '')) = 'reversal'
                              then p.amount else 0 end) as soma_reversoes
                from public.payments p
               where p.installment_id = i.id
            ) x on true
           where abs(coalesce(i."amountPaid", 0) -
                     (coalesce(x.soma_pagamentos, 0) - coalesce(x.soma_reversoes, 0))) > 0.01
        ) d
    ),
    'amostra', coalesce((
      select jsonb_agg(jsonb_build_object(
               'parcela', x.id,
               'contrato', x.contract_id,
               'numero', x.numero,
               'status', x.status,
               'valor', x.amount,
               'amountPaid', x.amount_paid,
               'soma_pagamentos', x.soma_pagamentos,
               'soma_reversoes', x.soma_reversoes,
               'efetivo', x.efetivo,
               'diferenca', round((x.amount_paid - x.efetivo)::numeric, 2)
             ) order by abs(x.amount_paid - x.efetivo) desc)
        from (
          select i.id, i.contract_id, i."installmentNumber" as numero, i.status,
                 i.amount, coalesce(i."amountPaid", 0) as amount_paid,
                 coalesce(x.soma_pagamentos, 0) as soma_pagamentos,
                 coalesce(x.soma_reversoes, 0) as soma_reversoes,
                 coalesce(x.soma_pagamentos, 0) - coalesce(x.soma_reversoes, 0) as efetivo
            from public.installments i
            left join lateral (
              select sum(case when lower(coalesce(p.type, '')) <> 'reversal'
                              then p.amount else 0 end) as soma_pagamentos,
                     sum(case when lower(coalesce(p.type, '')) = 'reversal'
                              then p.amount else 0 end) as soma_reversoes
                from public.payments p
               where p.installment_id = i.id
            ) x on true
           where abs(coalesce(i."amountPaid", 0) -
                     (coalesce(x.soma_pagamentos, 0) - coalesce(x.soma_reversoes, 0))) > 0.01
           order by abs(coalesce(i."amountPaid", 0) -
                        (coalesce(x.soma_pagamentos, 0) - coalesce(x.soma_reversoes, 0))) desc
           limit 30
        ) x
    ), '[]'::jsonb),
    'pagamentos_orfaos_sem_parcela', jsonb_build_object(
      'total', (select count(*) from public.payments where installment_id is null),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', p.id,
                 'tipo', p.type,
                 'valor', p.amount,
                 'data', p.payment_date,
                 'conta', p.account_id,
                 'descricao', p.description
               ) order by p.payment_date desc)
          from (
            select * from public.payments
             where installment_id is null
             order by payment_date desc
             limit 30
          ) p
      ), '[]'::jsonb)
    )
  ),

  -- =====================================================================
  -- Status x valores — o que a tela considera "em aberto" pode estar errado
  -- =====================================================================
  'status_vs_valores', jsonb_build_object(
    'acima_do_valor', jsonb_build_object(
      'total', (
        select count(*) from public.installments
         where coalesce("amountPaid", 0) > coalesce(amount, 0) + 0.01
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'parcela', i.id,
                 'contrato', i.contract_id,
                 'status', i.status,
                 'valor', i.amount,
                 'amountPaid', i."amountPaid",
                 'excesso', round((i."amountPaid" - i.amount)::numeric, 2)
               ) order by (i."amountPaid" - i.amount) desc)
          from (
            select * from public.installments
             where coalesce("amountPaid", 0) > coalesce(amount, 0) + 0.01
             order by ("amountPaid" - amount) desc
             limit 30
          ) i
      ), '[]'::jsonb)
    ),
    'quitado_com_saldo_devedor', jsonb_build_object(
      'total', (
        select count(*) from public.installments
         where lower(coalesce(status, '')) = 'quitado'
           and coalesce("amountPaid", 0) < coalesce(amount, 0) - 0.01
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'parcela', i.id,
                 'contrato', i.contract_id,
                 'valor', i.amount,
                 'amountPaid', i."amountPaid",
                 'falta', round((i.amount - coalesce(i."amountPaid", 0))::numeric, 2)
               ) order by (i.amount - coalesce(i."amountPaid", 0)) desc)
          from (
            select * from public.installments
             where lower(coalesce(status, '')) = 'quitado'
               and coalesce("amountPaid", 0) < coalesce(amount, 0) - 0.01
             order by (amount - coalesce("amountPaid", 0)) desc
             limit 30
          ) i
      ), '[]'::jsonb)
    ),
    'em_aberto_ja_integralmente_pago', jsonb_build_object(
      'total', (
        select count(*) from public.installments
         where lower(coalesce(status, '')) in ('aberto', 'atrasada', 'prorrogada')
           and coalesce("amountPaid", 0) >= coalesce(amount, 0) - 0.01
           and coalesce(amount, 0) > 0
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'parcela', i.id,
                 'contrato', i.contract_id,
                 'status', i.status,
                 'vencimento', i."dueDate",
                 'valor', i.amount,
                 'amountPaid', i."amountPaid"
               ) order by i."dueDate")
          from (
            select * from public.installments
             where lower(coalesce(status, '')) in ('aberto', 'atrasada', 'prorrogada')
               and coalesce("amountPaid", 0) >= coalesce(amount, 0) - 0.01
               and coalesce(amount, 0) > 0
             order by "dueDate"
             limit 30
          ) i
      ), '[]'::jsonb)
    ),
    'parcial_sem_pagamento_ou_ja_integral', jsonb_build_object(
      'total', (
        select count(*) from public.installments
         where lower(coalesce(status, '')) = 'parcial'
           and (coalesce("amountPaid", 0) <= 0.01
                or coalesce("amountPaid", 0) >= coalesce(amount, 0) - 0.01)
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'parcela', i.id,
                 'contrato', i.contract_id,
                 'valor', i.amount,
                 'amountPaid', i."amountPaid"
               ) order by i.id)
          from (
            select * from public.installments
             where lower(coalesce(status, '')) = 'parcial'
               and (coalesce("amountPaid", 0) <= 0.01
                    or coalesce("amountPaid", 0) >= coalesce(amount, 0) - 0.01)
             limit 30
          ) i
      ), '[]'::jsonb)
    ),
    'cancelada_com_dinheiro_recebido', jsonb_build_object(
      'total', (
        select count(*) from public.installments
         where lower(coalesce(status, '')) in ('cancelada', 'cancelado')
           and coalesce("amountPaid", 0) > 0.01
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'parcela', i.id,
                 'contrato', i.contract_id,
                 'valor', i.amount,
                 'amountPaid', i."amountPaid"
               ) order by i."amountPaid" desc)
          from (
            select * from public.installments
             where lower(coalesce(status, '')) in ('cancelada', 'cancelado')
               and coalesce("amountPaid", 0) > 0.01
             order by "amountPaid" desc
             limit 30
          ) i
      ), '[]'::jsonb)
    ),
    'estornado_com_dinheiro_recebido', jsonb_build_object(
      'total', (
        select count(*) from public.installments
         where lower(coalesce(status, '')) in ('estornado', 'estornada')
           and coalesce("amountPaid", 0) > 0.01
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'parcela', i.id,
                 'contrato', i.contract_id,
                 'valor', i.amount,
                 'amountPaid', i."amountPaid"
               ) order by i."amountPaid" desc)
          from (
            select * from public.installments
             where lower(coalesce(status, '')) in ('estornado', 'estornada')
               and coalesce("amountPaid", 0) > 0.01
             order by "amountPaid" desc
             limit 30
          ) i
      ), '[]'::jsonb)
    ),
    'parcelas_duplicadas', jsonb_build_object(
      'total', (
        select count(*) from (
          select contract_id, "installmentNumber"
            from public.installments
           group by 1, 2
          having count(*) > 1
        ) d
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'contrato', d.contract_id,
                 'numero', d.numero,
                 'ocorrencias', d.total
               ) order by d.total desc)
          from (
            select contract_id, "installmentNumber" as numero, count(*) as total
              from public.installments
             group by 1, 2
            having count(*) > 1
             order by count(*) desc
             limit 30
          ) d
      ), '[]'::jsonb)
    )
  ),

  -- =====================================================================
  -- Estornos — a regra do módulo depende do vínculo reverses_payment_id
  -- =====================================================================
  'estornos', jsonb_build_object(
    'total_reversal', (
      select count(*) from public.payments
       where lower(coalesce(type, '')) = 'reversal'
    ),
    'sem_vinculo_com_original', jsonb_build_object(
      'total', (
        select count(*) from public.payments
         where lower(coalesce(type, '')) = 'reversal'
           and reverses_payment_id is null
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', p.id,
                 'valor', p.amount,
                 'data', p.payment_date,
                 'parcela', p.installment_id,
                 'descricao', p.description
               ) order by p.payment_date desc)
          from (
            select * from public.payments
             where lower(coalesce(type, '')) = 'reversal'
               and reverses_payment_id is null
             order by payment_date desc
             limit 30
          ) p
      ), '[]'::jsonb)
    ),
    'vinculo_aponta_para_inexistente', jsonb_build_object(
      'total', (
        select count(*) from public.payments r
         where lower(coalesce(r.type, '')) = 'reversal'
           and r.reverses_payment_id is not null
           and not exists (select 1 from public.payments p where p.id = r.reverses_payment_id)
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'estorno', r.id,
                 'vinculo', r.reverses_payment_id,
                 'valor', r.amount,
                 'data', r.payment_date
               ) order by r.payment_date desc)
          from (
            select base.*
              from public.payments base
             where lower(coalesce(base.type, '')) = 'reversal'
               and base.reverses_payment_id is not null
               and not exists (
                     select 1 from public.payments p
                      where p.id = base.reverses_payment_id
                   )
             order by base.payment_date desc
             limit 30
          ) r
      ), '[]'::jsonb)
    ),
    'original_com_mais_de_uma_reversao', jsonb_build_object(
      'total', (
        select count(*) from (
          select reverses_payment_id
            from public.payments
           where lower(coalesce(type, '')) = 'reversal'
             and reverses_payment_id is not null
           group by 1
          having count(*) > 1
        ) d
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'original', d.original,
                 'reversoes', d.total
               ) order by d.total desc)
          from (
            select reverses_payment_id as original, count(*) as total
              from public.payments
             where lower(coalesce(type, '')) = 'reversal'
               and reverses_payment_id is not null
             group by 1
            having count(*) > 1
             order by count(*) desc
             limit 30
          ) d
      ), '[]'::jsonb)
    ),
    'reversao_de_parcela_diferente_do_original', jsonb_build_object(
      'total', (
        select count(*)
          from public.payments r
          left join public.payments p on p.id = r.reverses_payment_id
         where lower(coalesce(r.type, '')) = 'reversal'
           and r.reverses_payment_id is not null
           and p.id is not null
           and coalesce(r.installment_id, -1) <> coalesce(p.installment_id, -2)
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'estorno', x.id,
                 'parcela_estorno', x.parcela_estorno,
                 'parcela_original', x.parcela_original,
                 'valor', x.amount
               ) order by x.id)
          from (
            select r.id, r.amount,
                   r.installment_id as parcela_estorno,
                   p.installment_id as parcela_original
              from public.payments r
              join public.payments p on p.id = r.reverses_payment_id
             where lower(coalesce(r.type, '')) = 'reversal'
               and coalesce(r.installment_id, -1) <> coalesce(p.installment_id, -2)
             order by r.id
             limit 30
          ) x
      ), '[]'::jsonb)
    )
  ),

  -- =====================================================================
  -- A view que a tela lista x recálculo a partir das parcelas
  -- =====================================================================
  'view_vs_parcelas', jsonb_build_object(
    'linhas_view', (select count(*) from public.contract_receivables_summary),
    'linhas_contracts', (select count(*) from public.contracts),
    'contratos_fora_da_view', jsonb_build_object(
      'total', (
        select count(*) from public.contracts c
         where not exists (
                 select 1 from public.contract_receivables_summary v
                  where v.contract_id = c.id
               )
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'contrato', c.id,
                 'status', c.status,
                 'valor', c."contractValue"
               ) order by c.id)
          from (
            select c.* from public.contracts c
             where not exists (
                     select 1 from public.contract_receivables_summary v
                      where v.contract_id = c.id
                   )
             order by c.id
             limit 30
          ) c
      ), '[]'::jsonb)
    ),
    'a_receber_divergente', jsonb_build_object(
      'total', (
        select count(*)
          from public.contract_receivables_summary v
          join public.contracts c on c.id = v.contract_id
         where abs(coalesce(v.amount_to_receive, 0) -
                   coalesce((
                     select sum(i.amount - coalesce(i."amountPaid", 0))
                       from public.installments i
                      where i.contract_id = v.contract_id
                        and lower(coalesce(i.status, '')) not in
                            ('quitado', 'cancelada', 'cancelado',
                             'estornado', 'estornada')
                   ), 0)) > 0.01
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'contrato', x.contract_id,
                 'status', x.status,
                 'tela_a_receber', x.tela,
                 'saldo_real_parcelas', x.real,
                 'diferenca', round((x.tela - x.real)::numeric, 2)
               ) order by abs(x.tela - x.real) desc)
          from (
            select v.contract_id, c.status,
                   coalesce(v.amount_to_receive, 0) as tela,
                   coalesce((
                     select sum(i.amount - coalesce(i."amountPaid", 0))
                       from public.installments i
                      where i.contract_id = v.contract_id
                        and lower(coalesce(i.status, '')) not in
                            ('quitado', 'cancelada', 'cancelado',
                             'estornado', 'estornada')
                   ), 0) as real
              from public.contract_receivables_summary v
              join public.contracts c on c.id = v.contract_id
             where abs(coalesce(v.amount_to_receive, 0) -
                       coalesce((
                         select sum(i.amount - coalesce(i."amountPaid", 0))
                           from public.installments i
                          where i.contract_id = v.contract_id
                            and lower(coalesce(i.status, '')) not in
                                ('quitado', 'cancelada', 'cancelado',
                                 'estornado', 'estornada')
                       ), 0)) > 0.01
             order by abs(coalesce(v.amount_to_receive, 0) -
                          coalesce((
                            select sum(i.amount - coalesce(i."amountPaid", 0))
                              from public.installments i
                             where i.contract_id = v.contract_id
                               and lower(coalesce(i.status, '')) not in
                                   ('quitado', 'cancelada', 'cancelado',
                                    'estornado', 'estornada')
                          ), 0)) desc
             limit 30
          ) x
      ), '[]'::jsonb)
    ),
    'vencido_divergente', jsonb_build_object(
      'total', (
        select count(*)
          from public.contract_receivables_summary v
         where coalesce(v.overdue_amount, 0) <>
               coalesce((
                 select sum(i.amount - coalesce(i."amountPaid", 0))
                   from public.installments i
                  where i.contract_id = v.contract_id
                    and i."dueDate" < current_date
                    and lower(coalesce(i.status, '')) in
                        ('aberto', 'parcial', 'atrasada', 'prorrogada')
               ), 0)
      ),
      'amostra', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'contrato', x.contract_id,
                 'tela_vencido', x.tela,
                 'real_vencido', x.real,
                 'diferenca', round((x.tela - x.real)::numeric, 2)
               ) order by abs(x.tela - x.real) desc)
          from (
            select v.contract_id,
                   coalesce(v.overdue_amount, 0) as tela,
                   coalesce((
                     select sum(i.amount - coalesce(i."amountPaid", 0))
                       from public.installments i
                      where i.contract_id = v.contract_id
                        and i."dueDate" < current_date
                        and lower(coalesce(i.status, '')) in
                            ('aberto', 'parcial', 'atrasada', 'prorrogada')
                   ), 0) as real
              from public.contract_receivables_summary v
             where coalesce(v.overdue_amount, 0) <>
                   coalesce((
                     select sum(i.amount - coalesce(i."amountPaid", 0))
                       from public.installments i
                      where i.contract_id = v.contract_id
                        and i."dueDate" < current_date
                        and lower(coalesce(i.status, '')) in
                            ('aberto', 'parcial', 'atrasada', 'prorrogada')
                   ), 0)
             order by abs(coalesce(v.overdue_amount, 0) -
                          coalesce((
                            select sum(i.amount - coalesce(i."amountPaid", 0))
                              from public.installments i
                             where i.contract_id = v.contract_id
                               and i."dueDate" < current_date
                               and lower(coalesce(i.status, '')) in
                                   ('aberto', 'parcial', 'atrasada', 'prorrogada')
                          ), 0)) desc
             limit 30
          ) x
      ), '[]'::jsonb)
    ),
    'total_recebido_divergente', (
      select jsonb_build_object(
               'total', count(*),
               'amostra', coalesce(jsonb_agg(jsonb_build_object(
                        'contrato', d.contract_id,
                        'status', d.status,
                        'tela_recebido', d.tela,
                        'efetivo', d.efetivo,
                        'diferenca', round((d.tela - d.efetivo)::numeric, 2)
                      ) order by abs(d.tela - d.efetivo) desc), '[]'::jsonb)
             )
        from (
          select v.contract_id,
                 c.status,
                 coalesce(v.amount_received, 0) as tela,
                 coalesce(x.soma_pagamentos, 0) - coalesce(x.soma_reversoes, 0) as efetivo
            from public.contract_receivables_summary v
            join public.contracts c on c.id = v.contract_id
            left join lateral (
              select sum(case when lower(coalesce(p.type, '')) <> 'reversal'
                              then p.amount else 0 end) as soma_pagamentos,
                     sum(case when lower(coalesce(p.type, '')) = 'reversal'
                              then p.amount else 0 end) as soma_reversoes
                from public.payments p
                join public.installments i on i.id = p.installment_id
               where i.contract_id = v.contract_id
            ) x on true
           where abs(coalesce(v.amount_received, 0) -
                     (coalesce(x.soma_pagamentos, 0) - coalesce(x.soma_reversoes, 0))) > 0.01
        ) d
    )
  ),

  -- =====================================================================
  -- Índices e proteções de schema usadas pelo módulo
  -- =====================================================================
  'indices', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', c.relname,
             'indice', i.relname,
             'colunas', pg_get_indexdef(i.oid)
           ) order by c.relname, i.relname)
      from pg_index ix
      join pg_class c on c.oid = ix.indrelid
      join pg_class i on i.oid = ix.indexrelid
     where c.relnamespace = 'public'::regnamespace
       and c.relname in ('payments', 'installments')
  ), '[]'::jsonb),

  'checks_status', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tabela', c.relname,
             'constraint', conname,
             'definicao', pg_get_constraintdef(con.oid)
           ) order by c.relname, conname)
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
     where c.relnamespace = 'public'::regnamespace
       and c.relname in ('payments', 'installments', 'contracts')
       and contype = 'c'
  ), '[]'::jsonb)

)) as diagnostico_contas_a_receber;

rollback;

-- Rastreio forense — reversões sem vínculo e parcelas Quitado com saldo
-- 25/11/2026
--
-- Sequência de `docs/DIAGNOSTICO-CONTAS-A-RECEBER-20261125.sql`. Não corrige
-- nada: apenas expõe o histórico completo das 13 parcelas candidatas para
-- separar (a) estorno com original identificável, (b) estorno sem original no
-- histórico e (c) parcela Quitado com saldo por quitação antes da baixa total.
--
-- Regras reproduzidas de lib/payments.ts:
--   - reversão com `reverses_payment_id` usa o vínculo explícito;
--   - sem vínculo, procura pagamento de mesmo valor na mesma parcela que ainda
--     não foi estornado, preferindo o mais recente;
--   - a tela só carrega payments do mês corrente, então um estorno cujo
--     original está em outro mês não encontra o original no KPI.
--
-- NÃO grava vínculo, não atualiza saldo, não apaga nada. Termina em ROLLBACK.
--
-- Como usar: executar o arquivo inteiro no SQL Editor e copiar a ÚNICA célula
-- `rastreio_reversoes_20261125`.

begin;

with
-- 9 reversões sem vínculo, agrupadas pela parcela em que foram lançadas.
alvos_estorno as (
  select r.installment_id as id,
         count(*) as qtd_reversoes,
         coalesce(sum(r.amount), 0) as total_reversoes
    from public.payments r
   where lower(coalesce(r.type, '')) = 'reversal'
     and r.reverses_payment_id is null
     and r.installment_id is not null
   group by r.installment_id
),

-- 5 parcelas Quitado cujo valor da parcela ainda não foi integralmente pago.
alvos_quitado as (
  select i.id as id
    from public.installments i
   where lower(coalesce(i.status, '')) = 'quitado'
     and coalesce(i.amount, 0) - coalesce(i."amountPaid", 0) > 0.01
),

-- Uma parcela pode aparecer nos dois grupos; os marcadores são booleanos.
alvos as (
  select id,
         bool_or(por_estorno) as por_estorno,
         bool_or(por_quitado) as por_quitado
    from (
      select id, true as por_estorno, false as por_quitado from alvos_estorno
      union all
      select id, false, true from alvos_quitado
    ) u
   group by id
),

alvos_detalhe as (
  select a.por_estorno,
         a.por_quitado,
         i.id,
         i.contract_id,
         i."installmentNumber",
         i.status,
         i.amount,
         i."amountPaid",
         i.interest,
         i.fine,
         i."dueDate",
         i."original_due_date",
         i.environment,
         i.created_at,
         i.updated_by,
         c.status as contract_status,
         c."contractValue" as contract_value,
         c."amountReceived" as contract_received,
         coalesce(x.soma_pagamentos, 0) as soma_pagamentos,
         coalesce(x.soma_reversoes, 0) as soma_reversoes,
         coalesce(x.qtd_pagamentos, 0) as qtd_pagamentos,
         coalesce(x.qtd_reversoes, 0) as qtd_reversoes,
         coalesce(x.qtd_sem_vinculo, 0) as qtd_sem_vinculo,
         x.ultimo_pagamento,
         x.ultima_reversao
    from alvos a
    join public.installments i on i.id = a.id
    left join public.contracts c on c.id = i.contract_id
    left join lateral (
      select coalesce(sum(case when lower(coalesce(p.type, '')) = 'reversal'
                               then 0 else p.amount end), 0) as soma_pagamentos,
             coalesce(sum(case when lower(coalesce(p.type, '')) = 'reversal'
                               then p.amount else 0 end), 0) as soma_reversoes,
             count(*) filter (where lower(coalesce(p.type, '')) <> 'reversal') as qtd_pagamentos,
             count(*) filter (where lower(coalesce(p.type, '')) = 'reversal') as qtd_reversoes,
             count(*) filter (where lower(coalesce(p.type, '')) = 'reversal'
                                and p.reverses_payment_id is null) as qtd_sem_vinculo,
             max(p.payment_date) filter (where lower(coalesce(p.type, '')) <> 'reversal') as ultimo_pagamento,
             max(p.payment_date) filter (where lower(coalesce(p.type, '')) = 'reversal') as ultima_reversao
        from public.payments p
       where p.installment_id = i.id
    ) x on true
),

-- Histórico linha a linha, com saldo acumulado e transação vinculada.
historico as (
  select p.id,
         p.installment_id,
         p.type,
         p.amount,
         p.payment_date,
         p.created_at,
         p.account_id,
         p.category_id,
         p.description,
         p.payment_method,
         p.environment,
         p.organization_id,
         p.created_by,
         p.updated_by,
         p.financial_transaction_id,
         p.reverses_payment_id,
         ba.name as conta,
         fc.name as categoria,
         ft.id as ft_id,
         ft.date as ft_date,
         ft.amount as ft_amount,
         ft.type as ft_type,
         ft.description as ft_description,
         ft.created_at as ft_created_at,
         origem.id as origem_id,
         origem.amount as origem_valor,
         origem.payment_date as origem_data,
         row_number() over (
           partition by p.installment_id
           order by p.payment_date nulls last, p.created_at nulls last, p.id
         ) as seq,
         case when lower(coalesce(p.type, '')) = 'reversal'
              then -coalesce(p.amount, 0) else coalesce(p.amount, 0) end as variacao,
         sum(case when lower(coalesce(p.type, '')) = 'reversal'
                  then -coalesce(p.amount, 0) else coalesce(p.amount, 0) end) over (
           partition by p.installment_id
           order by p.payment_date nulls last, p.created_at nulls last, p.id
           rows between unbounded preceding and current row
         ) as saldo_acumulado
    from public.payments p
    join alvos a on a.id = p.installment_id
    left join public.bank_accounts ba on ba.id = p.account_id
    left join public.financial_categories fc on fc.id = p.category_id
    left join public.financial_transactions ft on ft.id = p.financial_transaction_id
    left join public.payments origem on origem.id = p.reverses_payment_id
),

-- Ordenação das reversões sem vínculo por parcela + valor, para não atribuir
-- o mesmo original a dois estornos de valor igual (comportamento do helper).
rev_sem_vinculo as (
  select r.*,
         row_number() over (
           partition by r.installment_id, r.amount
           order by r.payment_date nulls last, r.created_at nulls last, r.id
         ) as ordem_estorno
    from public.payments r
   where lower(coalesce(r.type, '')) = 'reversal'
     and r.reverses_payment_id is null
     and exists (select 1 from alvos a where a.id = r.installment_id)
),

-- Origens elegíveis para a heurística: mesmo valor/parcela, sem vínculo
-- explícito com outro estorno; mais recente primeiro.
origens_disponiveis as (
  select p.*,
         row_number() over (
           partition by p.installment_id, p.amount
           order by p.payment_date desc nulls last, p.created_at desc nulls last, p.id desc
         ) as ordem_original
    from public.payments p
   where lower(coalesce(p.type, '')) <> 'reversal'
     and not exists (
           select 1
             from public.payments x
            where lower(coalesce(x.type, '')) = 'reversal'
              and x.reverses_payment_id = p.id
         )
),

match_heuristica as (
  select r.id as reversao_id,
         (select count(*)
            from origens_disponiveis o
           where o.installment_id = r.installment_id
             and o.amount = r.amount) as candidatos_mesmo_valor,
         o.id as candidato_id,
         o.payment_date as candidato_data,
         o.amount as candidato_valor,
         (o.id is not null) as tem_candidato,
         (o.payment_date > r.payment_date) as candidato_depois_do_estorno,
         (
           select c.id
             from origens_disponiveis c
            where c.installment_id = r.installment_id
              and c.amount = r.amount
              and c.payment_date >= date_trunc('month', r.payment_date)
              and c.payment_date < date_trunc('month', r.payment_date) + interval '1 month'
            order by c.payment_date desc nulls last, c.created_at desc nulls last, c.id desc
            limit 1
         ) as candidato_no_mes_do_app
    from rev_sem_vinculo r
    left join origens_disponiveis o
      on o.installment_id = r.installment_id
     and o.amount = r.amount
     and o.ordem_original = r.ordem_estorno
),

-- Agregações por contrato feitas antes de montar o JSON, para não aninhar
-- funções de agregação dentro de jsonb_agg externo.
parcelas_por_contrato as (
  select i.contract_id,
         jsonb_agg(jsonb_build_object(
                    'parcela', i.id,
                    'numero', i."installmentNumber",
                    'status', i.status,
                    'valor', i.amount,
                    'amount_paid', i."amountPaid",
                    'saldo', round(greatest(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0), 2),
                    'vencimento', i."dueDate",
                    'vencimento_original', i."original_due_date",
                    'criado_em', i.created_at,
                    'atualizado_por', i.updated_by
                  ) order by i."installmentNumber", i.id) as parcelas
    from public.installments i
   where i.contract_id in (select contract_id from alvos_detalhe)
   group by i.contract_id
),

obs_por_contrato as (
  select c.id as contract_id,
         coalesce((
           select jsonb_agg(linha order by linha)
             from regexp_split_to_table(coalesce(c.observations, ''), E'\n') as linha
            where linha ilike '%[ESTORNO]%'
         ), '[]'::jsonb) as observacoes
    from public.contracts c
   where c.id in (select contract_id from alvos_detalhe)
)

select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),
  'pg_version', current_setting('server_version'),

  'aviso', 'Somente leitura. Os candidatos abaixo NAO sao vinculos confirmados e nenhum saldo foi alterado; o script termina em ROLLBACK.',

  'escopo', jsonb_build_object(
    'reversoes_no_total', (
      select count(*) from public.payments
       where lower(coalesce(type, '')) = 'reversal'
    ),
    'reversoes_sem_vinculo', (
      select count(*) from public.payments
       where lower(coalesce(type, '')) = 'reversal'
         and reverses_payment_id is null
    ),
    'parcelas_com_reversao_sem_vinculo', (select count(*) from alvos_estorno),
    'valor_reversoes_sem_vinculo', (select coalesce(sum(total_reversoes), 0) from alvos_estorno),
    'parcelas_quitado_com_saldo', (select count(*) from alvos_quitado),
    'saldo_quitado_com_saldo', (
      select coalesce(sum(greatest(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0)), 0)
        from public.installments i
       where lower(coalesce(i.status, '')) = 'quitado'
         and coalesce(i.amount, 0) - coalesce(i."amountPaid", 0) > 0.01
    ),
    'parcelas_unicas_analisadas', (select count(*) from alvos),
    'criterio', 'Reversoes sem reverses_payment_id + parcelas Quitado com amount - amountPaid > 0,01'
  ),

  -- =====================================================================
  -- Estado atual de cada parcela alvo, confrontado com o histórico de caixa
  -- =====================================================================
  'alvos', coalesce((
    select jsonb_agg(jsonb_build_object(
             'parcela', d.id,
             'contrato', d.contract_id,
             'numero_parcela', d."installmentNumber",
             'por_estorno_sem_vinculo', d.por_estorno,
             'por_quitado_com_saldo', d.por_quitado,
             'status_parcela', d.status,
             'valor_parcela', d.amount,
             'amount_paid', d."amountPaid",
             'juros', d.interest,
             'multa', d.fine,
             'saldo_parcela', round(greatest(coalesce(d.amount, 0) - coalesce(d."amountPaid", 0), 0), 2),
             'vencimento', d."dueDate",
             'vencimento_original', d."original_due_date",
             'ambiente', d.environment,
             'criado_em', d.created_at,
             'atualizado_por', d.updated_by,
             'status_contrato', d.contract_status,
             'contract_value', d.contract_value,
             'amount_received_contrato', d.contract_received,
             'soma_pagamentos', round(d.soma_pagamentos, 2),
             'soma_reversoes', round(d.soma_reversoes, 2),
             'liquido_historico', round(d.soma_pagamentos - d.soma_reversoes, 2),
             'divergencia_amount_paid', round(d."amountPaid" - (d.soma_pagamentos - d.soma_reversoes), 2),
             'qtd_pagamentos', d.qtd_pagamentos,
             'qtd_reversoes', d.qtd_reversoes,
             'qtd_estornos_sem_vinculo', d.qtd_sem_vinculo,
             'ultimo_pagamento', d.ultimo_pagamento,
             'ultima_reversao', d.ultima_reversao
           ) order by d.id)
      from alvos_detalhe d
  ), '[]'::jsonb),

  -- =====================================================================
  -- Histórico completo: pagamentos, estornos, transações e saldo acumulado
  -- =====================================================================
  'historico_pagamentos', coalesce((
    select jsonb_agg(jsonb_build_object(
             'parcela', h.installment_id,
             'seq', h.seq,
             'id', h.id,
             'tipo', h.type,
             'valor', h.amount,
             'data_pagamento', h.payment_date,
             'criado_em', h.created_at,
             'eh_estorno', lower(coalesce(h.type, '')) = 'reversal',
             'variacao_caixa', h.variacao,
             'saldo_acumulado', round(h.saldo_acumulado, 2),
             'descricao', h.description,
             'conta_id', h.account_id,
             'conta', h.conta,
             'categoria_id', h.category_id,
             'categoria', h.categoria,
             'forma_pagamento', h.payment_method,
             'ambiente', h.environment,
             'organization_id', h.organization_id,
             'criado_por', h.created_by,
             'atualizado_por', h.updated_by,
             'reverses_payment_id', h.reverses_payment_id,
             'origem_vinculada_id', h.origem_id,
             'origem_vinculada_valor', h.origem_valor,
             'origem_vinculada_data', h.origem_data,
             'financial_transaction_id', h.financial_transaction_id,
             'transacao_data', h.ft_date,
             'transacao_valor', h.ft_amount,
             'transacao_tipo', h.ft_type,
             'transacao_descricao', h.ft_description,
             'transacao_criada_em', h.ft_created_at
           ) order by h.installment_id, h.seq)
      from historico h
  ), '[]'::jsonb),

  -- =====================================================================
  -- Cada estorno sem vínculo x origens possíveis (heurística, não prova)
  -- =====================================================================
  'estornos_sem_vinculo', coalesce((
    select jsonb_agg(jsonb_build_object(
             'estorno_id', r.id,
             'parcela', r.installment_id,
             'contrato', d.contract_id,
             'valor', r.amount,
             'data', r.payment_date,
             'descricao', r.description,
             'conta_id', r.account_id,
             'ambiente', r.environment,
             'criado_em', r.created_at,
             'criado_por', r.created_by,
             'esta_no_mes_da_tela', date_trunc('month', r.payment_date) = date_trunc('month', now()),
             'pagamentos_antes_do_estorno', antes.qtd,
             'valor_pago_antes_do_estorno', round(antes.total, 2),
             'estorno_excede_pagamentos_anteriores', r.amount > coalesce(antes.total, 0) + 0.01,
             'candidatos_mesmo_valor_e_parcela', m.candidatos_mesmo_valor,
             'candidato_id', m.candidato_id,
             'candidato_data', m.candidato_data,
             'candidato_valor', m.candidato_valor,
             'candidato_apos_o_estorno', m.candidato_depois_do_estorno,
             'candidato_na_janela_do_kpi', m.candidato_no_mes_do_app,
             'classificacao', case
               when m.candidato_id is not null and m.candidato_data <= r.payment_date
                 then 'candidato exato por valor+parcela antes do estorno'
               when m.candidato_id is not null
                 then 'candidato exato, mas com data posterior ao estorno'
               when coalesce(antes.total, 0) > 0
                 then 'sem candidato de mesmo valor; ha pagamento anterior na parcela'
               else 'nenhum pagamento anterior registrado na parcela'
             end
           ) order by r.payment_date desc, r.id)
      from rev_sem_vinculo r
      join alvos_detalhe d on d.id = r.installment_id
      left join match_heuristica m on m.reversao_id = r.id
      left join lateral (
        select count(*) as qtd,
               coalesce(sum(p.amount), 0) as total
          from public.payments p
         where p.installment_id = r.installment_id
           and lower(coalesce(p.type, '')) <> 'reversal'
           and p.payment_date <= r.payment_date
      ) antes on true
  ), '[]'::jsonb),

  -- =====================================================================
  -- Parcelas Quitado com saldo: histórico x valor salvo x parcelas irmãs
  -- =====================================================================
  'quitado_com_saldo', coalesce((
    select jsonb_agg(jsonb_build_object(
             'parcela', d.id,
             'contrato', d.contract_id,
             'status_parcela', d.status,
             'valor_parcela', d.amount,
             'amount_paid', d."amountPaid",
             'falta', round(greatest(coalesce(d.amount, 0) - coalesce(d."amountPaid", 0), 0), 2),
             'soma_pagamentos', round(d.soma_pagamentos, 2),
             'soma_reversoes', round(d.soma_reversoes, 2),
             'qtd_pagamentos', d.qtd_pagamentos,
             'qtd_reversoes', d.qtd_reversoes,
             'ultimo_pagamento', d.ultimo_pagamento,
             'ultima_reversao', d.ultima_reversao,
             'liquido_historico', round(d.soma_pagamentos - d.soma_reversoes, 2),
             'amount_paid_bate_historico', abs(d."amountPaid" - (d.soma_pagamentos - d.soma_reversoes)) <= 0.01
           ) order by d.id)
      from alvos_detalhe d
     where d.por_quitado
  ), '[]'::jsonb),

  'parcelas_dos_contratos_alvo', coalesce((
    select jsonb_agg(jsonb_build_object(
             'contrato', p.contract_id,
             'parcelas', p.parcelas
           ) order by p.contract_id)
      from parcelas_por_contrato p
  ), '[]'::jsonb),

  -- =====================================================================
  -- Contratos e observações deixadas pela rotina de estorno
  -- =====================================================================
  'contratos_dos_alvos', coalesce((
    select jsonb_agg(jsonb_build_object(
             'contrato', c.id,
             'status', c.status,
             'ambiente', c.environment,
             'contract_value', c."contractValue",
             'amount_received', c."amountReceived",
             'amount_receivable', c."amountReceivable",
             'observacoes_de_estorno', o.observacoes
           ) order by c.id)
      from public.contracts c
      join obs_por_contrato o on o.contract_id = c.id
     where c.id in (select contract_id from alvos_detalhe)
  ), '[]'::jsonb),

  -- =====================================================================
  -- Transações de caixa vinculadas por ID (sem correspondência por aproximação)
  -- =====================================================================
  'transacoes_vinculadas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'parcela', p.installment_id,
             'pagamento_id', p.id,
             'tipo_pagamento', p.type,
             'valor_pagamento', p.amount,
             'transacao_id', ft.id,
             'data', ft.date,
             'valor', ft.amount,
             'tipo', ft.type,
             'conta_id', ft.account_id,
             'categoria_id', ft.category_id,
             'descricao', ft.description,
             'ambiente', ft.environment,
             'criado_em', ft.created_at
           ) order by ft.date, ft.id)
      from public.financial_transactions ft
      join public.payments p on p.financial_transaction_id = ft.id
     where p.installment_id in (select id from alvos)
  ), '[]'::jsonb),

  -- =====================================================================
  -- Auditoria: único meio de datar mudanças em installments (não tem updated_at)
  -- =====================================================================
  'auditoria_parcelas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id,
             'parcela', a.record_id,
             'action', a.action,
             'performed_at', a.performed_at,
             'performed_by', a.performed_by,
             'changed_fields', a.changed_fields,
             'old_status', a.old_data->>'status',
             'new_status', a.new_data->>'status',
             'old_amount_paid', a.old_data->>'amountPaid',
             'new_amount_paid', a.new_data->>'amountPaid',
             'old_amount', a.old_data->>'amount',
             'new_amount', a.new_data->>'amount',
             'environment', a.environment
           ) order by a.performed_at desc, a.id desc)
      from public.audit_logs a
     where a.table_name = 'installments'
       and a.record_id in (select id::text from alvos)
  ), '[]'::jsonb),

  'auditoria_contratos', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id,
             'contrato', a.record_id,
             'action', a.action,
             'performed_at', a.performed_at,
             'performed_by', a.performed_by,
             'changed_fields', a.changed_fields,
             'old_status', a.old_data->>'status',
             'new_status', a.new_data->>'status',
             'old_amount_received', a.old_data->>'amountReceived',
             'new_amount_received', a.new_data->>'amountReceived',
             'environment', a.environment
           ) order by a.performed_at desc, a.id desc)
      from public.audit_logs a
     where a.table_name = 'contracts'
       and a.record_id in (select contract_id::text from alvos_detalhe)
  ), '[]'::jsonb),

  'auditoria_pagamentos', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id,
             'pagamento', a.record_id,
             'action', a.action,
             'performed_at', a.performed_at,
             'performed_by', a.performed_by,
             'changed_fields', a.changed_fields,
             'old_amount', a.old_data->>'amount',
             'new_amount', a.new_data->>'amount',
             'old_type', a.old_data->>'type',
             'new_type', a.new_data->>'type',
             'old_reverses', a.old_data->>'reverses_payment_id',
             'new_reverses', a.new_data->>'reverses_payment_id',
             'environment', a.environment
           ) order by a.performed_at desc, a.id desc)
      from public.audit_logs a
     where a.table_name = 'payments'
       and a.record_id in (select id::text from historico)
  ), '[]'::jsonb),

  'limites_da_auditoria', jsonb_build_object(
    'installments_sem_updated_at', not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'installments'
         and column_name = 'updated_at'
    ),
    'payments_sem_updated_at', not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'payments'
         and column_name = 'updated_at'
    ),
    'audit_logs_disponivel', to_regclass('public.audit_logs') is not null,
    'regra_app', 'Vinculo explicito primeiro; sem vinculo, mesmo valor + mesma parcela, candidato mais recente ainda nao estornado',
    'janela_do_kpi', 'A tela carrega apenas payments do mes corrente. Estornos de outros meses nem entram no KPI; para eles, candidato_na_janela_do_kpi e ilustrativo. O campo esta_no_mes_da_tela identifica o unico estorno que afeta o KPI de novembro.',
    'candidatos', 'Sao apenas candidate de correspondência. Nao foram gravados em reverses_payment_id e nao autorizam UPDATE/DELETE.',
    'timezone', 'date_trunc(mes) usa o timezone da sessao do SQL Editor'
  )

)) as rastreio_reversoes_20261125;

rollback;

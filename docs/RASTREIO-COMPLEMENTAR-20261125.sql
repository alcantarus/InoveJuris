-- Rastreio complementar — origem removida da parcela 227 e residual da parcela 231
-- 25/11/2026
--
-- Continuação somente leitura de docs/RASTREIO-ESTORNOS-20261125.sql.
-- Não corrige nada: responde apenas às duas lacunas deixadas pela célula
-- `rastreio_reversoes_20261125`:
--   1. onde ficou o pagamento 3715c3de-f5ed-4ce9-a2ff-ca75fa43a3b9, cujo
--      vínculo foi removido da reversão da parcela 227 em 22/11 00:10:42 UTC;
--   2. se a parcela 239 (residual da parcela 231) tem pagamento próprio, ou se
--      nasceu quitada reaproveitando o pagamento da parcela 231.
--
-- Também explicita a ausência de registros em `audit_logs` para as cinco
-- reversões antigas (147, 87, 129, 103 e 148), que a célula anterior não
-- trouxe por não haver linhas.
--
-- NÃO grava vínculo, não atualiza saldo, não apaga nada. Termina em ROLLBACK.
--
-- AMBIENTE (regra permanente): banco único; `environment='production'` é
-- produção e `environment='test'` é homologação, na mesma instância. Todas as
-- linhas desta célula são `test`, mas vieram do banco único. A interpretação
-- deve declarar o rótulo. Ver docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Como usar: executar o arquivo inteiro no SQL Editor e copiar a ÚNICA célula
-- `rastreio_complementar_20261125`.
--
-- Executado pelo usuário em 26/11/2026 às 10:53:53 UTC (PG 17.6), em uma única
-- célula, terminado em ROLLBACK e interpretado em
-- docs/RASTREIO-ESTORNOS-RESULTADO-20261125.md.
--
-- Validação: escrito com os mesmos padrões do rastreio anterior, que foi
-- validado em PostgreSQL 18 descartável. Nesta rodada não havia instância
-- descartável disponível (Docker ausente e o PostgreSQL local exige senha),
-- portanto este arquivo NÃO foi executado antes de ser entregue.

begin;

with
-- Pagamentos citados diretamente pela célula anterior.
ids_em_questao as (
  select * from (values
    ('3715c3de-f5ed-4ce9-a2ff-ca75fa43a3b9'::uuid),
    ('9dc6e441-a731-4bc6-baa3-90899c26b4df'::uuid)
  ) as v(id)
),

-- Reversões antigas para as quais a célula anterior não mostrou auditoria.
reversoes_antigas as (
  select * from (values
    ('b02ef217-5694-4aca-8fac-cce3e14a3b0c'::uuid),
    ('fbf7f49b-3811-48e4-878b-6ec0ee711e3a'::uuid),
    ('543ce837-a774-4beb-b096-0fe856fe66f5'::uuid),
    ('e672c672-e53a-4a32-91de-2f57a9990380'::uuid),
    ('ba58e2cc-1d6b-4646-9a02-ac21631b162b'::uuid)
  ) as v(id)
)

select jsonb_pretty(jsonb_build_object(

  'coletado_em', now(),
  'pg_version', current_setting('server_version'),

  'aviso', 'Somente leitura. Nenhum vínculo foi gravado e nenhum saldo alterado; o script termina em ROLLBACK.',

  'orcamento', jsonb_build_object(
    'original_removido_da_227', '3715c3de-f5ed-4ce9-a2ff-ca75fa43a3b9',
    'pagamento_da_231', '9dc6e441-a731-4bc6-baa3-90899c26b4df',
    'parcelas_do_desdobramento', jsonb_build_array(227, 231, 239),
    'reversoes_antigas_sem_log', (
      select count(*) from reversoes_antigas r
       where not exists (
         select 1 from public.audit_logs a
          where a.table_name = 'payments'
            and a.record_id = r.id::text
       )
    )
  ),

  -- 1. O pagamento original da reversão da parcela 227 ainda existe?
  'original_da_reversao_227', (
    select jsonb_build_object(
             'id', p.id,
             'parcela', p.installment_id,
             'tipo', p.type,
             'valor', p.amount,
             'data_pagamento', p.payment_date,
             'criado_em', p.created_at,
             'ambiente', p.environment,
             'descricao', p.description,
             'conta_id', p.account_id,
             'forma_pagamento', p.payment_method,
             'reverses_payment_id', p.reverses_payment_id,
             'financial_transaction_id', p.financial_transaction_id,
             'criado_por', p.created_by,
             'na_janela_do_mes_corrente',
               p.payment_date >= date_trunc('month', now())
               and p.payment_date < date_trunc('month', now()) + interval '1 month'
           )
      from public.payments p
     where p.id = '3715c3de-f5ed-4ce9-a2ff-ca75fa43a3b9'::uuid
  ),

  'reversoes_que_apontam_para_o_original', (
    select count(*)
      from public.payments x
     where x.reverses_payment_id = '3715c3de-f5ed-4ce9-a2ff-ca75fa43a3b9'::uuid
  ),

  -- 2. Histórico completo das três parcelas do desdobramento.
  'historico_parcelas_227_231_239', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id,
             'parcela', p.installment_id,
             'tipo', p.type,
             'valor', p.amount,
             'data_pagamento', p.payment_date,
             'criado_em', p.created_at,
             'ambiente', p.environment,
             'descricao', p.description,
             'conta_id', p.account_id,
             'categoria_id', p.category_id,
             'forma_pagamento', p.payment_method,
             'reverses_payment_id', p.reverses_payment_id,
             'financial_transaction_id', p.financial_transaction_id,
             'criado_por', p.created_by
           ) order by p.installment_id, p.payment_date nulls last, p.created_at nulls last, p.id)
      from public.payments p
     where p.installment_id in (227, 231, 239)
  ), '[]'::jsonb),

  -- 3. Estado e auditoria das parcelas 227, 231 e 239.
  'parcelas_227_231_239', coalesce((
    select jsonb_agg(jsonb_build_object(
             'parcela', i.id,
             'contrato', i.contract_id,
             'numero', i."installmentNumber",
             'status', i.status,
             'valor', i.amount,
             'amount_paid', i."amountPaid",
             'saldo', round(greatest(coalesce(i.amount, 0) - coalesce(i."amountPaid", 0), 0), 2),
             'vencimento', i."dueDate",
             'criado_em', i.created_at,
             'atualizado_por', i.updated_by
           ) order by i.id)
      from public.installments i
     where i.id in (227, 231, 239)
  ), '[]'::jsonb),

  'auditoria_das_parcelas', coalesce((
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
             'environment', a.environment
           ) order by a.performed_at desc, a.id desc)
      from public.audit_logs a
     where a.table_name = 'installments'
       and a.record_id in ('227', '231', '239')
  ), '[]'::jsonb),

  -- 4. Auditoria dos dois pagamentos citados na célula anterior.
  'auditoria_dos_pagamentos', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id,
             'pagamento', a.record_id,
             'action', a.action,
             'performed_at', a.performed_at,
             'performed_by', a.performed_by,
             'changed_fields', a.changed_fields,
             'old_type', a.old_data->>'type',
             'new_type', a.new_data->>'type',
             'old_amount', a.old_data->>'amount',
             'new_amount', a.new_data->>'amount',
             'old_reverses', a.old_data->>'reverses_payment_id',
             'new_reverses', a.new_data->>'reverses_payment_id',
             'environment', a.environment
           ) order by a.performed_at desc, a.id desc)
      from public.audit_logs a
     where a.table_name = 'payments'
       and a.record_id in (
         select i.id::text from ids_em_questao i
       )
  ), '[]'::jsonb),

  -- 5. Toda linha de auditoria cujo old/new_data cite o original removido.
  'auditoria_que_cita_o_original', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id,
             'tabela', a.table_name,
             'registro', a.record_id,
             'action', a.action,
             'performed_at', a.performed_at,
             'performed_by', a.performed_by,
             'changed_fields', a.changed_fields,
             'old_data', a.old_data,
             'new_data', a.new_data,
             'environment', a.environment
           ) order by a.performed_at desc, a.id desc)
      from public.audit_logs a
     where coalesce(a.old_data::text, '') ilike '%3715c3de%'
        or coalesce(a.new_data::text, '') ilike '%3715c3de%'
  ), '[]'::jsonb),

  -- 6. Ausência confirmada de logs para as cinco reversões antigas.
  'reversoes_antigas_sem_auditoria', coalesce((
    select jsonb_agg(jsonb_build_object(
             'reversao', r.id::text,
             'qtd_logs', (
               select count(*) from public.audit_logs a
                where a.table_name = 'payments'
                  and a.record_id = r.id::text
             )
           ) order by r.id)
      from reversoes_antigas r
  ), '[]'::jsonb),

  -- 7. Transações de caixa vinculadas às parcelas do desdobramento.
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
             'descricao', ft.description,
             'criado_em', ft.created_at
           ) order by ft.date, ft.id)
      from public.financial_transactions ft
      join public.payments p on p.financial_transaction_id = ft.id
     where p.installment_id in (227, 231, 239)
  ), '[]'::jsonb),

  'limites', jsonb_build_object(
    'timezone', 'date_trunc(mês) usa o timezone da sessão do SQL Editor',
    'payments_sem_updated_at', not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'payments'
         and column_name = 'updated_at'
    ),
    'installments_sem_updated_at', not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'installments'
         and column_name = 'updated_at'
    ),
    'interpretacao', 'Ausência de linha em auditoria não prova que o lançamento nunca existiu; apenas que `audit_logs` não registrou a ação.'
  )

)) as rastreio_complementar_20261125;

rollback;

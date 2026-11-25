-- ============================================================================
-- DIAGNÓSTICO — parcela 207 / contrato 120 (status Estornado)
-- Data: 25/11/2026
--
-- Contexto:
--   Ao tentar receber parcialmente a parcela 207, a RPC respondeu
--   "A parcela 207 não possui saldo para desdobramento (status: Estornado)."
--   O diagnóstico de 07:32 mostrava essa parcela como 'Prorrogada'.
--
-- Objetivo:
--   1) ver o estado atual da parcela e do contrato;
--   2) ver todos os pagamentos/estornos da parcela;
--   3) ver o que o audit_logs registrou (quem/quando mudou o status);
--   4) ver a linha da view que a tela usa.
--
-- SOMENTE LEITURA. Termina em ROLLBACK.
-- Devolve uma célula: diagnostico_parcela_207
-- ============================================================================

begin;

select jsonb_pretty(jsonb_build_object(
  'coletado_em', now(),

  'parcela', (
    select to_jsonb(i) - 'created_by' - 'updated_by'
      from public.installments i
     where i.id = 207
  ),

  'contrato', (
    select jsonb_build_object(
             'id', c.id,
             'status', c.status,
             'environment', c.environment,
             'contract_value', c."contractValue",
             'amount_received', c."amountReceived",
             'amount_receivable', c."amountReceivable",
             'installments_count', c."installmentsCount",
             'observations', c.observations
           )
      from public.contracts c
     where c.id = 120
  ),

  'parcelas_do_contrato', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', i.id,
             'numero', i."installmentNumber",
             'vencimento', i."dueDate",
             'amount', i.amount,
             'amount_paid', i."amountPaid",
             'interest', i.interest,
             'fine', i.fine,
             'status', i.status,
             'environment', i.environment,
             'created_at', i.created_at
           ) order by i."installmentNumber", i.id), '[]'::jsonb)
      from public.installments i
     where i.contract_id = 120
  ),

  'pagamentos_da_parcela', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id,
             'type', p.type,
             'amount', p.amount,
             'payment_date', p.payment_date,
             'account_id', p.account_id,
             'category_id', p.category_id,
             'description', p.description,
             'payment_method', p.payment_method,
             'reverses_payment_id', p.reverses_payment_id,
             'financial_transaction_id', p.financial_transaction_id,
             'created_at', p.created_at,
             'created_by', p.created_by
           ) order by p.created_at), '[]'::jsonb)
      from public.payments p
     where p.installment_id = 207
  ),

  'transacoes_vinculadas', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', ft.id,
             'date', ft.date,
             'amount', ft.amount,
             'type', ft.type,
             'account_id', ft.account_id,
             'category_id', ft.category_id,
             'description', ft.description,
             'created_at', ft.created_at
           ) order by ft.id), '[]'::jsonb)
      from public.financial_transactions ft
     where ft.id in (
       select p.financial_transaction_id
         from public.payments p
        where p.installment_id = 207
          and p.financial_transaction_id is not null
     )
  ),

  'auditoria_parcela', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', a.id,
             'action', a.action,
             'performed_at', a.performed_at,
             'performed_by', a.performed_by,
             'changed_fields', a.changed_fields,
             'old_status', a.old_data->>'status',
             'new_status', a.new_data->>'status',
             'old_amount_paid', a.old_data->>'amountPaid',
             'new_amount_paid', a.new_data->>'amountPaid',
             'old_amount', a.old_data->>'amount',
             'new_amount', a.new_data->>'amount'
           ) order by a.performed_at desc), '[]'::jsonb)
      from public.audit_logs a
     where a.table_name = 'installments'
       and a.record_id = '207'
  ),

  'auditoria_contrato', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', a.id,
             'action', a.action,
             'performed_at', a.performed_at,
             'performed_by', a.performed_by,
             'changed_fields', a.changed_fields,
             'old_status', a.old_data->>'status',
             'new_status', a.new_data->>'status'
           ) order by a.performed_at desc), '[]'::jsonb)
      from public.audit_logs a
     where a.table_name = 'contracts'
       and a.record_id = '120'
  ),

  'view_tela', (
    select to_jsonb(v)
      from public.contract_receivables_summary v
     where v.contract_id = 120
  )
)) as diagnostico_parcela_207;

rollback;

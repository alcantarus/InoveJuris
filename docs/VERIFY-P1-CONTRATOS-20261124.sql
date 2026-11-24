-- VERIFICAÇÃO P1 — somente leitura. Célula única: verify_p1_contratos.

SELECT jsonb_pretty(jsonb_build_object(
  'verificado_em', now(),

  'constraint_unica_parcelas', EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_installments_contract_number'
      AND conrelid = 'public.installments'::regclass
  ),

  'indices_criados', COALESCE((
    SELECT jsonb_agg(nome ORDER BY nome)
    FROM (
      SELECT unnest(ARRAY[
        'uq_installments_contract_number',
        'idx_payments_installment_id',
        'idx_payments_environment',
        'idx_payments_type_payment_date',
        'idx_installments_due_date_status',
        'idx_installments_contract_id',
        'idx_commission_payments_contract_id',
        'idx_commission_payments_indicator_id'
      ]) AS nome
    ) x
    WHERE EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = x.nome AND c.relkind = 'i'
    )
  ), '[]'::jsonb),

  'indices_invalidos', COALESCE((
    SELECT jsonb_agg(c.relname ORDER BY c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname LIKE 'idx_%'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i WHERE i.indexrelid = c.oid AND i.indisvalid
      )
  ), '[]'::jsonb),

  'duplicatas_parcelas', (
    SELECT count(*)
    FROM (
      SELECT contract_id, "installmentNumber"
      FROM public.installments
      GROUP BY contract_id, "installmentNumber"
      HAVING count(*) > 1
    ) d
  ),

  'contagens', jsonb_build_object(
    'contracts', (SELECT count(*) FROM public.contracts),
    'installments', (SELECT count(*) FROM public.installments),
    'payments', (SELECT count(*) FROM public.payments),
    'commission_payments', (SELECT count(*) FROM public.commission_payments)
  )
)) AS verify_p1_contratos;

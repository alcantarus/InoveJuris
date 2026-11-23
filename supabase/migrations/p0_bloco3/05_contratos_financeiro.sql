-- Lote 05 — contratos, parcelas, pagamentos e financeiro

do $$
begin
  perform public._p0_drop_permissive(array[
    'contracts', 'installments', 'installment_history', 'payments',
    'commission_payments', 'financial_transactions', 'sales', 'financial_records'
  ]);
  perform public._p0_apply_isolation(array[
    'contracts', 'installments', 'installment_history', 'payments',
    'commission_payments', 'financial_transactions', 'sales', 'financial_records'
  ]);
end $$;

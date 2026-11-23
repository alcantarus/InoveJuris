-- Lote 03 — cadastros base

do $$
begin
  perform public._p0_drop_permissive(array[
    'law_areas', 'lawyers', 'diseases', 'products', 'indicators',
    'bank_accounts', 'financial_categories', 'product_diseases',
    'contract_diseases'
  ]);
  perform public._p0_apply_isolation(array[
    'law_areas', 'lawyers', 'diseases', 'products', 'indicators',
    'bank_accounts', 'financial_categories', 'product_diseases',
    'contract_diseases'
  ]);
end $$;

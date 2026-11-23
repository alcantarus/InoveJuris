-- Lote 04 — clientes e documentos de cliente
--
-- client_onboarding_tokens fica no lote 10 (fluxo público com header próprio).

do $$
begin
  perform public._p0_drop_permissive(array[
    'clients', 'client_tags', 'client_relationships',
    'client_interactions', 'client_documents'
  ]);
  perform public._p0_apply_isolation(array[
    'clients', 'client_tags', 'client_relationships',
    'client_interactions', 'client_documents'
  ]);
end $$;

-- P1 / Lote 02 — reduzir o SELECT do papel anon ao mínimo dos links públicos.
--
-- O inventário anterior mostrou 70 tabelas/views com SELECT para anon.
-- Os fluxos públicos (sem sessão) precisam ler apenas:
--   client_onboarding_tokens e clients -> onboarding;
--   indicator_tokens, indicators, contracts, commission_payments e
--   vw_portal_commission_details -> portal do indicador.
--
-- Usuários logados usam role=authenticated e não são afetados.
-- O UPDATE público em clients, concedido no lote 01, permanece intacto.

do $$
declare
  t record;
  v_item text;
  v_keep text[] := array[
    'client_onboarding_tokens',
    'indicator_tokens',
    'clients',
    'indicators',
    'contracts',
    'commission_payments',
    'vw_portal_commission_details'
  ];
begin
  -- Revoga SELECT de todas as tabelas/views publicas.
  for t in
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type in ('BASE TABLE', 'VIEW')
  loop
    execute format('revoke select on public.%I from anon', t.table_name);
  end loop;

  -- Devolve somente o necessario aos links publicos.
  foreach v_item in array v_keep loop
    execute format('grant select on public.%I to anon', v_item);
  end loop;
end $$;

notify pgrst, 'reload schema';

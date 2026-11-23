-- P1 / Lote 04b — correção do lote 04: remover o grant a PUBLIC.
--
-- O lote 04 revogou EXECUTE apenas de anon. Mas 16 dessas funções foram
-- concedidas a PUBLIC na criação (padrão do Postgres), e anon herda de PUBLIC.
-- Por isso elas continuaram executáveis por anon depois do lote 04.
--
-- Este lote, para cada função de negócio (todas as sobrecargas):
--   1. REVOKE EXECUTE FROM PUBLIC, anon  -> anon perde de vez o acesso;
--   2. GRANT EXECUTE TO authenticated, service_role -> logados e servidor
--      continuam funcionando (não dependem mais de PUBLIC).
--
-- Nenhum fluxo anon usa essas funções (verificado no código). As funções de
-- auth/sessão/admin, helpers de RLS e links públicos NÃO estão nesta lista e
-- permanecem como no lote 04. Idempotente: pode rodar mais de uma vez.

do $$
declare
  f record;
  v_names text[] := array[
    'search_all',
    'search_clients',
    'search_clients_accent_insensitive',
    'search_clients_basic',
    'get_clients_with_process_summary',
    'get_financial_chart_data',
    'get_financial_summary',
    'get_future_receivables_projection',
    'confirm_process_deadline',
    'create_process_deadline',
    'delete_process_deadline',
    'process_contract_cancellation',
    'process_installment_estorno',
    'process_installment_payment',
    'reverse_installment_payment',
    'rpc_receber_parcela_com_metodo',
    'rpc_recebimento_com_desdobramento',
    'save_client_guardians',
    'check_database_orphans',
    'djen_fetch',
    'normalize_deadline_at'
  ];
begin
  for f in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(v_names)
  loop
    execute format(
      'revoke execute on function public.%I(%s) from public, anon',
      f.proname, f.args
    );
    execute format(
      'grant execute on function public.%I(%s) to authenticated, service_role',
      f.proname, f.args
    );
  end loop;
end $$;

notify pgrst, 'reload schema';

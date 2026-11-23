-- P1 / Lote 01 — remover escrita do papel anon.
--
-- Diagnóstico: anon ainda tinha INSERT/UPDATE/DELETE/TRUNCATE em praticamente
-- todas as tabelas e views do schema public. As policies do Bloco 3 já
-- bloqueiam o acesso sem sessão, mas a grant ampla é uma segunda camada que
-- vale removê-la (defesa em profundidade).
--
-- Usuários logados NÃO são afetados: o JWT de sessão usa role=authenticated.
-- Os links públicos (anon) precisam apenas de:
--   SELECT em: indicator_tokens, client_onboarding_tokens, clients,
--              indicators, contracts, commission_payments,
--              vw_portal_commission_details;
--   UPDATE em: clients (onboarding atualiza os dados do cliente do token);
--   EXECUTE nas RPCs app_touch_indicator_token e app_mark_onboarding_used.
--
-- Este lote mantém todo SELECT como está e retira só a escrita. Um lote
-- posterior revisa os SELECTs um a um.

do $$
declare
  t record;
begin
  for t in
    select table_name, table_type
    from information_schema.tables
    where table_schema = 'public'
      and table_type in ('BASE TABLE', 'VIEW')
  loop
    execute format(
      'revoke insert, update, delete on public.%I from anon',
      t.table_name
    );

    if t.table_type = 'BASE TABLE' then
      execute format(
        'revoke truncate on public.%I from anon',
        t.table_name
      );
    end if;
  end loop;

  -- Única exceção de escrita pública: o onboarding altera somente a linha do
  -- cliente vinculada ao token. A policy P0 onboarding escrita limita o alvo.
  execute 'grant update on public.clients to anon';
end $$;

notify pgrst, 'reload schema';

-- Lote 13 — nome do indicador no portal.
--
-- O portal faz `indicator_tokens.select('..., indicators(name)')`. Como
-- `indicators` recebeu apenas a policy `P0 sessao` no lote 03, o join feito
-- pelo visitante (anon, sem sessão) volta vazio e o nome cai no fallback
-- genérico "Indicador".
--
-- Esta policy permite ler somente a linha do indicador vinculado ao token da
-- URL. Não abre acesso amplo: sem token válido, _rls_portal_indicator_id()
-- retorna null e nenhuma linha passa.

do $$
begin
  execute format('drop policy if exists %I on public.indicators', 'P0 portal indicador leitura');
  execute format($f$
    create policy %I on public.indicators
      for select to anon, authenticated
      using (id = public._rls_portal_indicator_id())
  $f$, 'P0 portal indicador leitura');
end $$;

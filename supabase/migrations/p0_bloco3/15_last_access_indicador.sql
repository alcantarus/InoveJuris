-- Lote 15 — último acesso dos links do portal do indicador.
--
-- Depois do lote 12 o visitante do link só tem SELECT em indicator_tokens.
-- Para registrar o último acesso sem devolver escrita ao navegador, usamos
-- uma RPC SECURITY DEFINER que só atualiza a coluna last_accessed_at e só
-- aceita um token ativo e não expirado.

alter table public.indicator_tokens
  add column if not exists last_accessed_at timestamptz;

create or replace function public.app_touch_indicator_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.indicator_tokens
     set last_accessed_at = now()
   where token = p_token
     and coalesce(is_active, false) = true
     and (expires_at is null or expires_at > now());

  return found;
end;
$$;

revoke all on function public.app_touch_indicator_token(text) from public;
grant execute on function public.app_touch_indicator_token(text) to anon, authenticated;

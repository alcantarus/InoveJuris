-- P1.1 — apply (banco / RLS de sessão)
-- 23/11/2026
--
-- Aplicar no SQL Editor do Supabase. Nada é executado pelo agente.
--
-- Decisões tomadas a partir do diagnóstico (docs/DIAGNOSTICO-P1-1-RESUMO.sql):
--   1. _auth_session_payload() é VOLATILE em produção -> passa a STABLE.
--      O corpo é IDÊNTICO ao de produção; muda só a volatilidade.
--   2. _rls_session_valid() deixa de montar o JSON completo do usuário e passa
--      a um EXISTS direto, com as MESMAS regras: sessão ativa, logout nulo,
--      environment da claim, heartbeat de 90s, login de 12h e usuário válido.
--   3. NENHUM índice novo: user_sessions tem 207 linhas e o EXPLAIN da
--      listagem por ambiente já faz Seq Scan em 0,163 ms.
--   4. get_auth_organization() existe e já é STABLE. A policy legada
--      "Isolamento por Organização em users" NÃO é alterada.
--   5. Nenhuma policy, grant ou role é alterado. CREATE OR REPLACE preserva
--      os grants atuais de EXECUTE.
--
-- Os 110 ms medidos em `count(*) from clients` não são resolvidos aqui: vêm
-- da avaliação de _rls_can_access(environment) por linha nas policies. Essa
-- frente será tratada separadamente, com medição própria.

begin;

-- ---------------------------------------------------------------------------
-- 1) _auth_session_payload(): volumetria declarada como STABLE
-- ---------------------------------------------------------------------------
create or replace function public._auth_session_payload(
  p_session_id uuid,
  p_environment text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_session public.user_sessions%rowtype;
  v_user public.users%rowtype;
begin
  if p_session_id is null then
    return null;
  end if;

  select * into v_session
  from public.user_sessions
  where id = p_session_id;

  if not found or v_session.logout_at is not null then
    return null;
  end if;

  if p_environment is not null and v_session.environment <> p_environment then
    return null;
  end if;

  -- Heartbeat a cada 20s; 90s de tolerância cobrem pausas curtas no celular
  -- sem deixar uma sessão órfã por minutos após o fechamento da aba.
  if v_session.last_seen_at < now() - interval '90 seconds' then
    return null;
  end if;

  if v_session.login_at < now() - interval '12 hours' then
    return null;
  end if;

  select * into v_user
  from public.users
  where id = v_session.user_id;

  if not found then
    return null;
  end if;

  if v_user.expiration_date is not null and v_user.expiration_date < current_date then
    return null;
  end if;

  return public._auth_user_payload(v_user, v_session.id)
         || jsonb_build_object('environment', v_session.environment);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) _rls_session_valid(): booleano enxuto, sem construir JSON
--    Equivalente a `_auth_session_payload(id, env) is not null`.
-- ---------------------------------------------------------------------------
create or replace function public._rls_session_valid()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
      from public.user_sessions s
      join public.users u on u.id = s.user_id
     where s.id = public._rls_session_id()
       and s.logout_at is null
       and (
             public._rls_environment() is null
             or s.environment = public._rls_environment()
           )
       and (s.last_seen_at is null or s.last_seen_at >= now() - interval '90 seconds')
       and (s.login_at is null or s.login_at >= now() - interval '12 hours')
       and (u.expiration_date is null or u.expiration_date >= current_date)
  );
$$;

commit;

-- FORWARD — get_auth_organization() passa a ler a claim JWT
-- 27/11/2026
--
-- REGRA PERMANENTE: banco unico; `production` e `test` sao valores de
-- `environment`, nao databases separados.
-- Ambiente declarado: production + test.
--
-- Situacao atual: a funcao e STABLE SECURITY DEFINER e le
--   current_setting('custom.organization_id', true) — GUC que nenhum codigo
--   do app define. Resultado: NULL, e a policy legada de users so funciona
--   para superadmin.
--
-- O que muda:
--   - passa a ler `organization_id` do payload do JWT assinado, via
--     public._rls_claims() -> auth.jwt() -> request.jwt.claims;
--   - mantem assinatura, tipo de retorno, SECURITY DEFINER e grants atuais;
--   - converte valor invalido em NULL em vez de lancar excecao;
--   - guarda a definicao original em tabela de backup para rollback exato.
--
-- O que NAO muda:
--   - nenhuma policy, view, RPC ou linha de negocio;
--   - nenhuma coluna organization_id;
--   - nenhum dado de production ou test.
--
-- Depois: rodar docs/VERIFY-GET-AUTH-ORGANIZATION-JWT-CLAIM-20261127.sql.
-- Para desfazer: docs/ROLLBACK-GET-AUTH-ORGANIZATION-JWT-CLAIM-20261127.sql.

begin;

create table if not exists public._tenant_jwt_org_backup_20261127 (
  id integer primary key,
  funcao text not null,
  definicao text not null,
  capturado_em timestamptz not null default now()
);

insert into public._tenant_jwt_org_backup_20261127 (id, funcao, definicao)
select 1, 'public.get_auth_organization()',
       pg_get_functiondef('public.get_auth_organization()'::regprocedure)
where not exists (
  select 1 from public._tenant_jwt_org_backup_20261127 where id = 1
);

create or replace function public.get_auth_organization()
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_raw text;
begin
  -- Unica fonte de verdade: o payload do JWT validado pelo PostgREST.
  v_raw := nullif(
             btrim(coalesce(public._rls_claims() ->> 'organization_id', '')),
             ''
           );

  if v_raw is null then
    return null;
  end if;

  begin
    return v_raw::uuid;
  exception when invalid_text_representation then
    -- Claim malformada nao pode derrubar uma policy de RLS.
    return null;
  end;
end;
$$;

commit;

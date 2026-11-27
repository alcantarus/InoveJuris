-- FORWARD — fundação do Escopo de Ambiente (T3/T4a)
-- 26/11/2026
--
-- REGRA PERMANENTE: banco único; `production` e `test` são valores de
-- `environment`, não bancos separados. Ver docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md.
--
-- Medição prévia (obrigatória, já feita em 26/11):
--   organizations: 2 linhas, sem coluna environment (catálogo global);
--   helpers _rls_organization_id() e _rls_test_shared() ausentes;
--   tenant_test_scope ausente em production/test;
--   get_auth_organization() existe e NÃO é alterado;
--   63 policies, 0 com USING (true) real (falso positivo corrigido);
--   nulos de organization_id em production impedem o braço dedicado.
--
-- O que muda:
--   - cria os helpers _rls_organization_id() e _rls_test_shared();
--   - concede EXECUTE para anon/authenticated (necessário em policies);
--   - cria a configuração tenant_test_scope em production (canônica).
--
-- O que NÃO muda:
--   - nenhuma linha de negócio;
--   - nenhuma policy;
--   - nenhuma view, RPC, storage bucket ou dado de production/test.
--
-- NÃO EXECUTAR SEM AUTORIZAÇÃO EXPLÍCITA DO USUÁRIO.
-- Depois: rodar docs/VERIFY-ESCOPO-FUNDACAO-20261126.sql.
-- Para desfazer: docs/ROLLBACK-ESCOPO-FUNDACAO-20261126.sql.

begin;

-- Identidade da organização ativa da sessão. A claim já é assinada em
-- lib/jwt.ts e app/api/auth/session/route.ts:81-87; aqui ela apenas é lida.
create or replace function public._rls_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select nullif(public._rls_claims()->>'organization_id', '')::uuid;
$$;

-- Configuração canônica em production. A coluna `environment` da tabela
-- system_settings é explicitamente declarada, conforme a convenção.
create or replace function public._rls_test_shared()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
           (
             select (s.value->>'mode') = 'shared'
               from public.system_settings s
              where s.key = 'tenant_test_scope'
                and s.environment = 'production'
           ),
           false
         );
$$;

-- Helpers internos usados dentro de policies: o autor da policy precisa de
-- EXECUTE, exatamente como _rls_can_access() em 00_fundacao.sql:248-250.
revoke all on function public._rls_organization_id() from public, anon, authenticated;
revoke all on function public._rls_test_shared() from public, anon, authenticated;

grant execute on function public._rls_organization_id() to anon, authenticated;
grant execute on function public._rls_test_shared() to anon, authenticated;

do $$
begin
  insert into public.system_settings (key, value, description, category, environment)
  values (
    'tenant_test_scope',
    '{"mode":"shared"}'::jsonb,
    'Escopo da homologação: compartilhada entre organizações (leitura e escrita)',
    'tenant',
    'production'
  )
  on conflict (key, environment) do nothing;

  if found then
    raise notice 'tenant_test_scope criado em production com mode=shared.';
  else
    raise notice 'tenant_test_scope já existia em production; valor preservado.';
  end if;
end $$;

commit;

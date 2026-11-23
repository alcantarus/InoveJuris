# Plano adiado — rotação ECC/ES256 e multitenancy (23/11/2026)

> **Status: ADIADO.** Nada deste plano foi executado em código, banco, Vercel ou Supabase.
> Registrado logo após o fechamento do P2 (lotes 01–03 + onboarding), com `main` em
> `68a8765`. Requer autorização explícita antes de qualquer ação.
>
> Fontes canônicas: `docs/PARECER-JWT.md`, `docs/PARECER-TENANT-INOVEJURIS.md`,
> `docs/HANDOFF-PENDENCIAS-20261120.md`, `supabase/migrations/STATUS_SEGURANCA.md`.

---

## Parte A — Rotação da chave ECC/ES256

### A.1 Situação atual

- O app assina o JWT de sessão com `SUPABASE_JWT_SECRET` (HS256) como **ponte provisória**.
- `lib/jwt.ts:88-102` já prefere `SUPABASE_JWT_PRIVATE_JWK` (ES256) quando a variável existe;
  `SUPABASE_JWT_KID` sobrescreve o `kid` do JWK.
- Supabase → *Project Settings → API → JWT Keys*:
  - Current: ES256 `kid 83b7ae9a…`, chave privada **não exportável**.
  - Standby `c73f6852-eeca-455d-9549-647afae7e493` bloqueia nova importação.
- Vercel: `SUPABASE_JWT_SECRET` em Production, Preview e Development;
  `SUPABASE_JWT_PRIVATE_JWK` ainda ausente.
- Estimativa registrada: 1–1,5 h de trabalho; destravar a standby leva 10–15 min no painel
  ou 1–3 dias úteis via Supabase Support.

### A.2 Ponto crítico — mudança de comportamento após o Bloco 3

Antes do Bloco 3, se o preflight do PostgREST falhasse, o app seguia **sem token** e
continuava funcionando pelas policies permissivas. Isso **não vale mais**: sem token,
`_rls_session_valid()` retorna `false` (`p0_bloco3/00_fundacao.sql:79-90`) e as telas ficam
vazias/403.

Ordem obrigatória: **o Supabase precisa aceitar a chave nova antes de a Vercel passar a
assinar com ela.** A trava de preflight (`lib/jwt.ts:36-70`) barra tokens recusados, mas
também impede que o token chegue ao navegador — hoje isso é uma indisponibilidade de dados,
não um modo degradado inofensivo.

### A.3 Passo a passo

1. **Pré-check**
   - Confirmar `SUPABASE_JWT_SECRET` nos três ambientes da Vercel e ausência de
     `SUPABASE_JWT_PRIVATE_JWK`.
   - Confirmar no painel Supabase a Current e a standby bloqueada.
   - Registrar commit/deploy atual como ponto de retorno.

2. **Destravar a standby**
   - Marcar `c73f6852-eeca-455d-9549-647afae7e493` como *Previously used*/revogada.
   - Se a UI não permitir, abrir chamado no Supabase Support.

3. **Gerar chave ES256 (P-256) localmente**
   - Executar na máquina local; **não colar o JSON resultante neste repositório nem na
     conversa**. Guardar em cofre/secret manager.

```powershell
node -e "const {generateKeyPairSync}=require('crypto'); const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}); const jwk=privateKey.export({format:'jwk'}); console.log(JSON.stringify({...jwk, kid:'inovejuris-es256-20261123', alg:'ES256', use:'sig'}))"
```

4. **Importar e promover no Supabase**
   - *JWT Keys → Import/Add key* → colar o JWK privado com o mesmo `kid`.
   - Promover a nova chave a **Current**.
   - Manter a chave antiga em *Previously used* durante toda a validação (tokens antigos
     expiram em 10 min).
   - Confirmar o JWKS:

```powershell
curl https://jhlxzqsgmudkbjkynqdl.supabase.co/auth/v1/.well-known/jwks.json
```

   - O `kid` novo deve aparecer.

5. **Configurar a Vercel — somente após o passo 4**
   - `SUPABASE_JWT_PRIVATE_JWK` = JSON de uma linha.
   - `SUPABASE_JWT_KID` = `inovejuris-es256-20261123`.
   - Manter `SUPABASE_JWT_SECRET` temporariamente.
   - Aplicar em Development → Preview → Production e fazer deploy.
   - Usar `vercel env add ...` interativamente para não deixar a chave no histórico do shell.

6. **Validar**
   - Fazer login e ler o `token` devolvido por `/api/auth/session`; decodificar **localmente**
     (não enviar para sites de terceiros).
   - Esperado: header `alg=ES256`, `kid` configurado; claims `role=authenticated`, `sub`,
     `environment`, `session_id`, `exp-iat=600`.
   - Console: nenhum `[jwt] PostgREST recusou o token`. Se aparecer, o preflight bloqueou o
     token — voltar ao passo 4 antes de seguir.
   - Testar: login, navegação, heartbeat >10 min, portal do indicador, onboarding, RBAC 403,
     upload/signed-url.

7. **Remover a ponte HS256**
   - Após ~24 h estável: `vercel env rm SUPABASE_JWT_SECRET` nos três ambientes + redeploy.
   - Validar novamente. Só depois remover a chave antiga do *Previously used*.

### A.4 Rollback

- Readicionar `SUPABASE_JWT_SECRET`, remover `SUPABASE_JWT_PRIVATE_JWK` e
  `SUPABASE_JWT_KID`, redeploy.
- Se necessário, repromover a chave antiga no Supabase.
- Não apagar a chave antiga antes da estabilidade.

---

## Parte B — `organization_id` / multitenancy real

### B.1 Peças já aproveitáveis

- O JWT **já carrega `organization_id`**: `lib/jwt.ts:150`, origem em `users.organization_id`
  via `app/api/auth/session/route.ts:86`.
- RLS já tem `_rls_claims()`, `_rls_environment()`, `_rls_session_valid()`,
  `_rls_can_access()` em `supabase/migrations/p0_bloco3/00_fundacao.sql`.
- Existe uma policy legada em `users` que usa `get_auth_organization()`.
- O eixo `production/test` já é validado no banco.
- As policies permissivas `USING (true)` foram substituídas pelo Bloco 3 (checklist 100%).

Falta transformar a claim em **autoridade de tenant**, com membership validada no servidor.
**Nunca** derivar o tenant de cookie ou parâmetro do front; a autoridade tem de ser a sessão
validada no Postgres.

### B.2 Decisões de produto — antes de qualquer SQL

Responder primeiro (detalhes em `docs/PARECER-TENANT-INOVEJURIS.md:539-553`):

1. Um tenant por escritório pagante ou filiais de um mesmo escritório?
2. Um usuário pertence a vários tenants?
3. **E-mail pode se repetir entre tenants?** Decisão mais estrutural: define `users.email`
   global ou por tenant.
4. Superadmin é global ou por organização?
5. `production/test` é global ou por tenant?
6. Auditoria e backup são por tenant?
7. Logout global encerra todas as organizações ou só a ativa?
8. White-label desde o início ou depois?
9. Congelar/remover legado (`/setup`, `clientes-v2`, `doencas`, rotas `-1`, migrations
   `-1/-2`) antes ou depois?

### B.3 Fase T0 — backup e ponto de retorno

1. Criar e publicar tag `pre-tenant-t0`.
2. Registrar deploy atual e timestamp PITR.
3. Exportação lógica completa: schema, dados, `system_settings`, Storage. **Atenção:** `npx
   supabase db dump` já falhou aqui por falta de Docker; usar o mecanismo de exportação via
   API SQL adotado no F0.
4. Salvar o SQL exato das policies atuais para rollback.
5. Guardar tudo fora do repositório, com SHA256.

### B.4 Fase T1 — fundação aditiva (invisível)

1. Criar `organizations` (id, slug, name, status, plan, timestamps).
2. Criar `organization_members` (organization_id, user_id, role/status, is_default, PK
   composta).
3. Criar tenant padrão com **todos os dados atuais**.
4. Vincular usuários existentes ao tenant padrão (reaproveitar `users.organization_id`
   legado quando existir).
5. Nenhuma coluna nova em tabelas de domínio ainda.
6. Rollback: dropar as duas tabelas novas.

### B.5 Fase T2 — colunas e índices (expand)

Adicionar `organization_id uuid NULL` em lotes:

1. `clients`, `lawyers`, `law_areas`, `products`, `diseases`
2. `processes`, `contracts`, `installments`, `payments`, financeiro
3. `process_deadlines`, `publications`, `client_relationships`, `tasks`, `notifications`
4. logs, auditoria, históricos, sync
5. views e storage

Por lote: coluna nullable → índice `CONCURRENTLY` → backfill → verificação:

```sql
select count(*) from public.<tabela> where organization_id is null;
-- esperado: 0
```

Manter as unicidades antigas até o final; criar as novas com tenant em paralelo.

### B.6 Fase T3 — sessão e contexto (primeira mudança visual)

1. `organization_id` em `user_sessions` como organização ativa da sessão.
2. Helper derivado do JWT, não de cookie:

```sql
create or replace function public._rls_organization_id()
returns uuid language sql stable security definer
set search_path = public, extensions
as $$
  select nullif(public._rls_claims()->>'organization_id', '')::uuid
$$;
```

3. RPC `app_switch_organization` validando membership antes de trocar a ativa.
4. Sidebar/EnvBanner mostram a organização ativa.
5. Revisar `app_logout_all_user_sessions()` conforme a decisão 7.
6. Decidir se `get_auth_organization()` legado é substituído ou mantido por compatibilidade.

### B.7 Fase T4 — observação (sem quebrar nada)

1. Proxy client/server passa a tratar a organização da sessão.
2. RPCs `SECURITY DEFINER` passam a validar membership internamente.
3. Logs de observação para acesso fora do tenant.
4. Feature flag para ligar/desligar.
5. Ajustar `search_all`, financeiro, prazos, Publicações, backup/restore, DJEN/DataJud.

Objetivo: descobrir consulta que esqueceu o filtro antes de aplicar RLS restritiva.

### B.8 Fase T5 — RLS restritiva

1. Remover as policies P0 atuais e criar policies por membership usando
   `_rls_organization_id()` + `organization_members`.
2. Recriar views com `organization_id` e `security_invoker=on`.
3. Ajustar canais Realtime.
4. Storage com path `organization_id/...`.
5. `system_settings` com chave `(key, environment, organization_id)`.
6. Auditoria com tenant, sessão e autor reais.

Validação mínima: duas organizações de teste + tentativa deliberada de acessar ID da outra
→ deve falhar.

### B.9 Fase T6 — telas em lotes

Um módulo por deploy, com 1–2 dias de uso real entre eles:

Dashboard → Clientes → Processos → Prazos/Calendário → Publicações → Contratos/Financeiro
→ Relatórios → Documentos → Configurações/Usuários → Auditoria.

### B.10 Fase T7 — operação locável

Onboarding de tenant, convites, plano/limites, white-label, backup por tenant, retenção LGPD
por tenant, portais por token com tenant, congelamento do legado.

---

## Ordem recomendada de retomada

1. Rotação ECC (curta, sem schema/RLS).
2. Respostas às 9 decisões de produto.
3. T0/T1 do multitenancy.

## Verificação inicial útil (somente leitura)

```sql
-- users já tem a coluna usada hoje pela claim?
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'users'
  and column_name = 'organization_id';

-- contexto de RLS disponível
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    '_rls_claims', '_rls_environment', '_rls_session_valid',
    '_rls_can_access', 'get_auth_organization'
  )
order by 1;

-- amostra das policies atuais
select tablename, policyname, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('clients', 'processes', 'contracts')
order by 1, 2;
```

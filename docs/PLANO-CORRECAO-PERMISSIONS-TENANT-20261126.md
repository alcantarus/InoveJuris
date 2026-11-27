# Plano — `permissions` como catálogo global (retomada 27/11/2026)

> **Nada foi executado nem comitado.** Este é o plano para a próxima sessão.
> Origem: achado do `VERIFY-TESTE-1-ISOLACAO-20261126.sql` (26/11, 21:54Z)
> e análise registrada em `docs/HANDOFF-TENANT-20261126.md` §6.1.

---

## 1. Contexto

O `dados_isolados` passou: 42 tabelas com `organization_id`, **0 linhas fora do
mapa de tenant**, `environment` e `organization_id` alinhados em toda tabela com
dados. Sete tabelas têm só dados de `production`; dessas, **uma é risco real**:

| Tabela | `production` | `test` |
|---|---:|---:|
| `permissions` | 22 | **0** |
| `role_permissions` | 60 | 23 |
| `roles` | 5 | 2 |
| `user_roles` | 4 | 0 |

`client_tags`, `login_attempts`, `marketing_logs`, `trusted_devices` e `users`
também são só-produção, mas são **esperados** (logs/config e o superadmin que
entra em `test` com usuário de `production`). Não se corrige.

---

## 2. Causa (confirmada no código)

1. `app_get_rbac()` — `supabase/migrations/20261123000000_p0_rbac_rpc.sql:57-63`:
   ```sql
   select ... from public.permissions p;   -- sem filtro de ambiente
   select ... from public.roles r where r.environment = v_env;
   ```
   Ou seja, a RPC **já trata `permissions` como catálogo global**.

2. Proxy do cliente — `lib/supabase.ts`:
   - `permissions` está em `TABELAS_COM_ORGANIZATION_ID` → recebe o filtro de
     `organization_id` do JWT.
   - `permissions` **não** está na lista de tabelas globais
     (`users`, `user_sessions`, `geo_cache`, `organizations`,
     `client_onboarding_tokens`, `indicator_tokens`, `contract_diseases`) →
     recebe também `.eq('environment', currentEnv)`.

3. Resultado em `test`: `permissions` filtrado por `environment = 'test'` e
   `organization_id = demo` → **zero linhas**.

4. `app/usuarios/page.tsx:91-99` busca:
   ```ts
   supabase.from('roles').select(`
     id, name,
     role_permissions ( permissions (slug) )
   `)
   ```
   Sem `permissions` no demo, os perfis aparecem **sem slugs de permissão**,
   apesar de existirem 23 vínculos em `test`.

---

## 3. Correção recomendada (sem tocar em dados)

Tratar `permissions` como catálogo global, igual a `organizations`.

### Passo 1 — `lib/supabase.ts`

- Remover `'permissions'` do `Set` `TABELAS_COM_ORGANIZATION_ID` (linha ~55).
- Acrescentar `table === 'permissions' ||` ao `if` das tabelas globais (early
  return), ao lado de `organizations`.

### Passo 2 — `lib/supabase-server.ts`

- Acrescentar `permissions` à allowlist de tabelas globais, por consistência
  (hoje só `organizations` foi adicionada).

### Passo 3 — Validação local

```powershell
npx tsc --noEmit
npx eslint lib/supabase.ts lib/supabase-server.ts app/usuarios/page.tsx
```

Restaurar `tsconfig.tsbuildinfo` com `git checkout -- tsconfig.tsbuildinfo` se
ele aparecer no `git status`.

### Passo 4 — Publicar

Commit + push em `main`. A Vercel publica automaticamente.

### Passo 5 — Validar em `test`

1. Logout + login novo em `test` (aba anônima, para descartar token antigo).
2. Abrir `/usuarios` em `test`.
3. Confirmar que cada perfil lista as permissões (slugs) — antes apareciam vazias.
4. Confirmar que `production` continua igual (catálogo sempre foi global na RPC;
   a mudança só remove o filtro do Proxy no cliente).
5. DevTools → Console sem erros vermelhos.

### Rollback

Reverter o commit. **Nenhuma linha de dados é alterada.**

---

## 4. Alternativa NÃO recomendada (só com autorização explícita)

Inserir 22 linhas de `permissions` no tenant demo (`environment = 'test'`,
`organization_id = demo`) e atualizar os 23 `role_permissions` de `test` para
apontar aos novos IDs.

Problemas:
- `INSERT`/`UPDATE` em dados de negócio — exige autorização explícita.
- Não resolve a incoerência com `app_get_rbac()`, que continua lendo global.
- Cria duplicidade de catálogo (`access_dashboard` em dois tenants).

Só executar se houver decisão formal de que RBAC deve ser tenant-aware. Nesse
caso, é um projeto separado (unificação RBAC ↔ booleanas de `users`), já
listado como pendente no `PARECER-TENANT-INOVEJURIS.md`.

---

## 5. Verificação somente-leitura sugerida antes de mexer

Rodar no SQL Editor (arquivo separado, `begin`/`rollback`, uma única célula):

- contar `permissions` por `environment`/`organization_id`;
- contar `role_permissions` de `test` cujo `permission_id` existe no catálogo;
- listar `roles` de `test` com a quantidade de permissões resolvidas.

Isso confirma que os 23 vínculos apontam para os 22 slugs existentes e que a
correção de código (não de dados) é suficiente.

---

## 6. Ordem geral da retomada (27/11)

1. Fechar o **`erro_console`** do Teste 1, se ainda aberto.
2. Executar a verificação somente-leitura da seção 5.
3. Aplicar a correção de código das seções 1–3 e publicar.
4. Validar `/usuarios` em `test` e `production`.
5. Só depois seguir para Teste 2 (configurações/backup/OAuth), prazos,
   responsáveis legais e comissão.
6. **Não executar pagamentos, estornos ou cancelamentos até o Teste 1 fechar.**

---

## 7. Restrições lembradas

- Nenhum `UPDATE`/`DELETE` em dados de negócio sem autorização explícita.
- Nenhuma credencial no chat; senha apenas no terminal.
- Não colar conteúdo de dumps nem linhas completas de prévias.
- Não atualizar Supabase CLI de `2.75.0` para `v3.4.0`.
- Não comitar sem pedido explícito.
- Toda rotina declara/filtra/traz `environment`.

# Handoff — Tenant/Organização — 26/11/2026

> Documento de retomada. Nada aqui é instrução para o SQL Editor.
> Todo SQL deve ser executado em arquivo `docs/*.sql`, em uma única célula.
> **Nada foi comitado.**

---

## 1. Status geral

| Item | Estado |
|---|---|
| Backup pré-tenant | Concluído e validado |
| Limpeza das tabelas de backup | Concluída; somente `backup_logs` preservada |
| Correção dos 24 conflitos de `environment` | Concluída |
| Backfill histórico de `organization_id` | Concluído: 1.899 registros em 6 lotes |
| Trigger de preenchimento no INSERT | Concluída em 39 tabelas |
| Item 1 — `SessionContext.organizationId` | Implementado |
| Item 2 — claim JWT + Proxy no cliente | Implementado |
| Item 3 — RPCs, `system_settings` e guarda financeira | **Concluído** (`item3_concluido = true`) |
| Testes funcionais | **Teste 1 — claim PASSOU** (26/11, 21:35Z): `organizacao_no_token` = UUID da org demo; faltam `dados_isolados` e `erro_console` para fechar |
| Código local da correção do claim | **Publicado**: commit `49cfb21` em `main` (tsc/eslint OK); deploy Vercel já aplicado |

Usuário executou todo SQL no Supabase. O assistente não executou `UPDATE`/`DELETE` em dados de negócio.

---

## 2. Backup e segurança

Diretório local:

`C:\Users\ALCANTARUS\Backups\InoveJuris\pre-tenant-20261126`

Artefatos principais:

| Arquivo | Tamanho | SHA-256 |
|---|---:|---|
| Estrutura (`schema`) | 815.738 bytes | `6620A67639243E89804DFBCD66E25C7E98E598790279FCA860C33C098564DC31` |
| Dados | 2.193.162 bytes | `8528956FABED9DC34ED418E765F7352947986A863B6E2163C311E8FAB3854A63` |
| Perfis/roles | 7.464 bytes | `A349568008FE586635E1B8CABA47A4FE9B512210AE2EDA5DA1B4BD184E4092F5` |
| Export das 17 tabelas removidas | 139.782 bytes | `58F958028EC6BD63C78A53098A64C3DD0ADAB459851353F9EBFDE3E27CB22E08` |

Também há segunda cópia em pen drive, Storage baixado e restore local parcial. Restore 100% não foi finalizado por limitação do PostgreSQL local (`pg_hba.conf` em `scram-sha-256`; `psql` local pede senha). Não houve upgrade do Supabase CLI: instalada continua `2.75.0`; o cache `.temp/cli-latest` foi restaurado.

Plano Free confirmado: sem PITR e sem backups automáticos.

---

## 3. Mapa de ambientes

| Ambiente | Organização | Característica |
|---|---|---|
| `production` | Alcântara Advocacia | `is_demo = false` |
| `test` | InoveJuris Demonstração | `is_demo = true` |

Regra adotada e já aplicada no banco pelo trigger `trg_fill_organization_id`:

- `production` → organização de produção;
- `test` → organização demo;
- `app.organization_id` tem prioridade quando presente;
- o trigger atua somente em `INSERT`.

Verificação `docs/VERIFY-ORGANIZACOES-DEMO-20261126.sql` confirmou: `total = 2`, `demo = 1`, `demo_mapeada_e_unica = true`, `producao_nao_demo = true`.

---

## 4. O que foi aplicado no Supabase

### Estrutura e dados

- 17 tabelas com “backup” removidas; `backup_logs` preservada.
- Verify da limpeza: `56` tabelas, `62` policies, `0` views/funções com referência a backup.
- 24 registros com `environment` conflitante corrigidos; backup `_correcao_ambiente_24_20261126`.
- Backfill em 6 lotes: `9 + 71 + 69 + 168 + 512 + 1070 = 1899`.
- Verificação global: `tabelas_verificadas = 39`, `tabelas_com_trigger_org = 39`, `nulos_production_test = 0`, `organization_id_errados = 0`, `backups_conferem = true`.
- Triggers de auditoria/financeiras reativadas após os lotes; `triggers_publicas_desabilitadas = []`.

### `system_settings`

- PK antiga `(key, environment)` removida.
- Criada `UNIQUE NULLS NOT DISTINCT (key, environment, organization_id)`.
- `organization_id` continua anulável — necessário para o OAuth global.
- Callback OAuth continua com `organization_id = null`.
- 4 upserts ajustados para `onConflict: 'key,environment,organization_id'`.
- `publications` fora do escopo.

### RPCs e guarda

Blocos aplicados, cada um com `FORWARD` / `VERIFY` / `ROLLBACK`:

- `create_process_deadline`, `update_process_deadline`, `confirm_process_deadline`, `delete_process_deadline`
- `save_client_guardians`
- `app_register_commission_payment`
- `rpc_receber_parcela_com_metodo`
- Guarda `zz_tenant_guard_dml` em `installments`, `payments`, `financial_transactions`, `contracts`, `commission_payments`

`public._tenant_rpc_backup_20261126` contém 7 corpos originais preservados.

`_tenant_guard_dml_fn()` lê o claim JWT. Sem claim (service role/anon/tarefas internas) ele é no-op.

`tgtype = 31` = `ROW(1) + BEFORE(2) + INSERT(4) + DELETE(8) + UPDATE(16)`. O `VERIFY` corrigido usa `31`, não `14`.

### Verificação final do item 3

`docs/VERIFY-FINAL-ITEM-3-20261126.sql` retornou:

- `ambiente_declarado = production + test`
- `helper_claim = true`
- `system_settings`: `pk_antiga_removida = true`, `unique_tenant_presente = true`, `organization_id_permite_nulo = true`
- `rpc_backup_linhas = 7`
- `rpcs_protegidas = 7`
- `guard_funcao = true`
- `guard_triggers_ativas = 5`
- `item3_concluido = true`

---

## 5. Código local alterado (ainda não publicado)

| Arquivo | Alteração |
|---|---|
| `lib/organization.ts` | Novo. Resolve o tenant por ambiente: `test` → organização demo; `production` → organização do usuário. Nunca aceita valor do cliente. |
| `app/api/auth/session/route.ts` | `withSessionToken`, heartbeat e `switch_environment` reassinam o JWT com o tenant do ambiente. Extraído `getUserForSession`. |
| `lib/server-auth.ts` | `SessionContext.organizationId` usa o mesmo resolvedor. |
| `lib/auth.tsx` | Após troca de ambiente, guarda `data.token` antes do reload. |
| `lib/supabase.ts` | `organizations` incluída na allowlist de tabelas globais. |
| `lib/supabase-server.ts` | `organizations` incluída na allowlist de tabelas globais. |

Arquivos de código já modificados antes desta correção:

- `app/api/auth/email/callback/route.ts`
- `app/api/backup/generate/route.ts`
- `app/api/settings/update/route.ts`
- `lib/server-auth.ts`
- `lib/session-token.ts`
- `lib/supabase.ts`

Validações locais após a última mudança:

- `npx tsc --noEmit` — OK
- `npm run build` — OK

`tsconfig.tsbuildinfo` e `supabase/.temp/cli-latest` foram restaurados para não poluir o diff.

---

## 6. Teste 1 — onde paramos

Objetivo: confirmar que, em `test`, o JWT carrega a organização demo.

**Resultado do claim (26/11/2026, após deploy `49cfb21`):**

```json
{
  "environment": "test",
  "organizacao_no_token": "cf4c416b-f28b-4c1e-b4dc-a5f723f09ecd",
  "usuario_id": "2",
  "is_superadmin": true,
  "token_environment": "test",
  "token_emitido_em": "2026-11-26T21:35:23.000Z"
}
```

`cf4c416b-...` é a organização demo — confirmada por
`docs/VERIFY-USUARIOS-AMBIENTE-TENANT-20261126.sql` (`teste_is_demo = true`).
**Claim PASSOU.**

**`dados_isolados` (26/11, 21:54Z) — PASSOU** (`VERIFY-TESTE-1-ISOLACAO-20261126.sql`):
- 42 tabelas com `organization_id`; 29 com linhas demo; **0 linhas fora do mapa**
  (`total_org_fora_do_mapa = 0`); `org_outra = 0` em todas.
- `environment` e `organization_id` **perfeitamente alinhados** em toda tabela com
  dados: `env_test = org_demo` e `env_production = org_producao` (ex.: clients
  6/107, contracts 20/106, installments 70/119, payments 59/123,
  financial_transactions 66/1128).
- Única linha sem tenant: `integration_logs` (1), tabela global sem `environment`
  — **esperado** (config OAuth global; handoff define callback com `organization_id = null`).
- 7 tabelas só com dados de `production`: `client_tags`, `login_attempts`,
  `marketing_logs`, `permissions`, `trusted_devices`, `user_roles`, `users`
  (5 usuários, nenhum em `test` — o superadmin entra em `test` com usuário de
  `production`). **Análise completa na seção 6.1** — só `permissions` é risco real.
- 5 tabelas vazias: `client_documents`, `legal_contract_workflow`,
  `legal_contracts`, `task_history`, `tasks` — nunca tiveram dados; nada a corrigir.
- Sessões ativas: **2 em `test`, ambas com organização `test`**.
- Demo única e `is_demo = true`; produção única e não-demo.

**`erro_console` (26/11, relato do usuário): PASSOU** — "sem erros" no DevTools
durante a operação em `test`/Contas a Receber (inclusive no momento do
recebimento da parcela 1, 21:40). Não houve toast de erro. Para fecho formal,
confirmar também a navegação em `/usuarios` e a lista de permissões dos perfis
(ver §6.1).

Diagnóstico anterior (com o código antigo em execução):

```json
{
  "environment": "test",
  "organizacao_no_token": "production",
  "usuario_id": "2",
  "is_superadmin": true
}
```

Dados de apoio já medidos no banco:

- Usuário `2`: `environment = production`, organização `production`, superadmin, acesso a `production` e `test`.
- Usuários: `5` em `production`/organização de produção; **nenhum** em `test`.
- Sessões ativas: `2` em `test`, ambas com organização `test`.
- Organizações: demo única e mapeada; produção única e não-demo.

Conclusão: **não é problema de dados**. A trigger e as sessões já usam a organização demo em `test`. O JWT ainda está sendo assinado com o vínculo do usuário.

Causa identificada no código: `getSupabaseServer()` envolvia a consulta a `organizations` com `.eq('environment', ...)`, mas `organizations` é catálogo global e não tem essa coluna. A consulta falhava, o helper caía no fallback e retornava `users.organization_id`. A allowlist foi corrigida, o código foi publicado (`49cfb21`) e o claim passou.

---

## 6.1. Análise dos achados de `dados_isolados` (26/11/2026)

Pergunta do usuário: "esses erros são um problema? Como se corrigem?"

### Não são problema — não se corrige

| Achado | Veredicto | Motivo |
|---|---|---|
| `integration_logs` com 1 linha sem tenant | **Esperado** | Tabela global de config OAuth, sem `environment`. Handoff já define callback com `organization_id = null`. |
| `users`: 5 em `production`, 0 em `test` | **Esperado** | Superadmin entra em `test` com usuário de `production` (vínculo fixo, resolvido pelo JWT). |
| `login_attempts`, `marketing_logs`, `client_tags`, `trusted_devices` só em `production` | **Esperado** | Logs/config; o demo nunca gerou esses registros. Se `trusted_devices` pedir 2FA em `test`, é cadastro do dispositivo demo — decisão, não bug. |
| `user_roles`: 4 em `production`, 0 em `test` | **Não quebra acesso** | Controle efetivo usa as booleanas em `users` (`canAccess*`), não RBAC. |
| 5 tabelas vazias (`client_documents`, `legal_contract_workflow`, `legal_contracts`, `task_history`, `tasks`) | **Nada a corrigir** | Nunca tiveram registros em nenhum ambiente. |

### ⚠️ Risco real: `permissions` sem linhas em `test`

**Mecanismo (confirmado no código):**
- `app_get_rbac()` em `supabase/migrations/20261123000000_p0_rbac_rpc.sql:57-63`
  **já lê `permissions` globalmente**, sem filtro de ambiente; filtra só `roles`
  por `environment` (linha 80).
- O Proxy em `lib/supabase.ts` inclui `permissions` em
  `TABELAS_COM_ORGANIZATION_ID` e **não** está na lista de tabelas globais
  (`users`, `user_sessions`, `geo_cache`, `organizations`,
  `client_onboarding_tokens`, `indicator_tokens`, `contract_diseases`).
- Logo, em `test`, toda consulta ao cliente recebe
  `.eq('environment','test').eq('organization_id', demo)` → **0 linhas**.
- `app/usuarios/page.tsx:91-99` busca
  `roles → role_permissions → permissions(slug)`. Com `permissions` vazio,
  os perfis aparecem **sem nenhuma permissão listada** no demo, embora existam
  23 `role_permissions` em `test`.

**Correção recomendada (sem tocar em dados)** — ver
`docs/PLANO-CORRECAO-PERMISSIONS-TENANT-20261126.md`:
1. `lib/supabase.ts`: remover `'permissions'` de `TABELAS_COM_ORGANIZATION_ID`.
2. `lib/supabase.ts`: acrescentar `permissions` ao `if` de tabelas globais (early return).
3. `lib/supabase-server.ts`: mesmo tratamento, por consistência.
4. Rollback = reverter o commit. Nenhum `INSERT`/`UPDATE` em dados de negócio.

**Alternativa não recomendada agora:** criar 22 `permissions` no tenant demo e
atualizar os 23 `role_permissions` para os novos IDs. Exige autorização
explícita, backup e `FORWARD/VERIFY/ROLLBACK`.

---

## 6.2. Validação ponta a ponta — contrato 138 (26/11/2026, homologação)

Usuário lançou em `test` o contrato **138** (Anderson Jose da Silva), 15.000,00
em 5 parcelas de 3.000,00; recebeu 1.500,00 da parcela 1, gerou a residual de
1.500,00 (parcela 263) e informou ter recebido essa residual em dinheiro.

**Scripts (somente leitura, linhas normais, sem JSON, `ROLLBACK`):**
- `docs/VERIFY-CADEIA-CONTRATO-138-TENANT-20261126.sql` — cadeia + preenchimento de tenant;
- `docs/VERIFY-CADEIA-CONTRATO-138-INVESTIGA-20261126.sql` — estado, pagamentos, caixa e auditoria.

### Resultado do tenant — PASSOU

9 linhas (contrato, 6 parcelas, 1 `payment`, 1 transação) com
`organization_id = cf4c416b-...` e `environment = test` em **todas**;
`sem organization_id: 0`, resumo `SUCESSO`. Isso cobre `contracts`,
`installments` (originais **e** residual), `payments` e
`financial_transactions` — prova prática de que `trg_fill_organization_id` e
`zz_tenant_guard_dml` preencheram o tenant sem deixar coluna nula.

### Resultado da operação — recebimento da residual NÃO foi gravado

| Evidência | Valor |
|---|---|
| Parcela 258 (nº 1) | `Quitado`, 3.000,00, pago 1.500,00 — correto |
| Parcela 263 (nº 6, residual) | **`Aberto`, pago 0,00** — não foi quitada |
| `payments` | **1** linha (`2ad3c0a2-...`, parcela 1, Dinheiro, 1.500,00) |
| `financial_transactions` | **1** linha (`1291`, income 1.500,00, conta 8) |
| `audit_logs` 16821/16822/16823/16824 (21:40:05) | UPDATE 258, UPDATE contrato (intermediário 12.000), INSERT 263, UPDATE contrato final (13.500) |
| Depois de 21:40:05 | **nenhum** UPDATE em 263, nenhum `payment` novo, nenhuma transação nova |

Conclusão: o **desdobramento** ocorreu e ficou íntegro, inclusive com o estado
intermediário conhecido (`amountReceivable` 12.000 antes da residual, 13.500
depois). O **recebimento em dinheiro da residual não chegou ao banco** — não
houve chamada bem-sucedida da RPC para a parcela 263. Não é falha de tenant.

### Correção de interpretação (registro de honestidade)

Afirmei antes que, após o recebimento da residual, o contrato deveria mostrar
`pago = 3.000` e `a receber = 12.000`. Isso só valeria **se** a residual tivesse
sido recebida. Como ela continua `Aberto` com 0 pago, os valores atuais
(`pago = 1.500`, `a receber = 13.500`) estão **corretos**. O rótulo
`OK — residual 1.500` da consulta significa "residual criada com valor correto",
não "residual recebida".

**Confirmado pelo usuário:** sem toast de erro e sem erro vermelho no console
por volta de 21:40. Logo, a RPC da residual **não foi executada** — não foi
falha de banco, de trigger nem de tenant. Causa provável é no-op do front:
botão confirmar desabilitado (`!paymentAccount || !paymentCategory ||
!paymentMethod`, em `app/contas-a-receber/page.tsx:1299`), modal fechado sem
confirmação, ou duplo clique bloqueado por `receiveProcessingRef`
(linhas 1301/1321/1349). Não refazer o pagamento sem confirmar qual desses
cenários ocorreu. `erro_console` do Teste 1 fechado como PASS.

**Resolvido no teste 2 (26/11):** o recebimento integral da residual foi gravado
com sucesso — `PASS` na conferência. Detalhes e evidências em §6.4.

---

## 6.3. Correção visual de Contas a Receber (26/11/2026) — aplicada, não publicada

Pedido do usuário: "pode corrigir" a apresentação das parcelas vista na tela do
contrato 138.

**Arquivo alterado:** `app/contas-a-receber/page.tsx` (somente front; nenhum SQL,
nenhuma RPC, nenhum dado tocado).

O que mudou:

1. **"A Receber" da parcela desdobrada** — a parcela 1 (3.000 / pago 1.500 /
   `Quitado`) mostrava `R$ 0,00`, parecendo quitada pagando metade. Agora exibe
   `—` com tooltip "Saldo transferido para a parcela residual".
2. **Badge `Desdobrada`** na parcela original fechada com pagamento parcial
   (`status = Quitado` e `0 < pago < valor`), no desktop e no card mobile.
3. **Badge `Residual`** na subparcela (`installmentNumber` acima de
   `contracts.installmentsCount`; fallback por vencimento repetido + valor menor
   quando o total não está disponível), no desktop e no mobile.
4. **Ordenação por vencimento** e, no empate, por número: a residual passa a
   aparecer ao lado da origem (138: 1, 6, 2, 3, 4, 5) em vez de no fim.
5. **Card mobile** — `line-through`/fundo rosa agora só para `Cancelada` (antes
   `Quitado` também era riscado, parecendo cancelamento).
6. **"Cancelar Contrato"** — condição extraída para `cancelBlocked` + `title`
   explicando o bloqueio (contrato quitado ou com pagamento registrado).
7. `openContract` passou a carregar `installmentsCount` para identificar a
   residual sem depender do fallback.

**Validação:** `npx tsc --noEmit` sem erros; `npx eslint app/contas-a-receber/page.tsx`
sem erros (1 warning pré-existente de `react-hooks/exhaustive-deps` em
`receivableKpis`, já presente no `HEAD`). `tsconfig.tsbuildinfo` restaurado.

**Rollback:** `git checkout -- app/contas-a-receber/page.tsx` (nada foi comitado).

**Publicado e validado (26/11):** commit `7bf4c09` em `main`; deploy de produção
`dpl_3Q2KBjFKyAyBoM3aqdoL5UXR3urq` (`Ready`, alias `https://inove-juris.vercel.app`).
Usuário conferiu a tela do contrato 138 e aprovou: parcela 1 com badge
`Desdobrada` e "A Receber" `—`; parcela 6 com badge `Residual` logo abaixo da 1;
ordem 1, 6, 2, 3, 4, 5. A residual 263 continua `Aberto` — a correção foi só de
apresentação.

---

## 6.4. Teste do recebimento da residual 263 — roteiro (27/11 ou a seguir)

Teste autorizado: o Teste 1 está fechado. É escrita **em `test`**, não em produção.

**Pré-requisito:** ambiente `test` selecionado no app (o domínio de produção serve
os dois ambientes).

Roteiro:
1. (Opcional) Rodar `docs/VERIFY-RESIDUAL-263-POS-RECEBIMENTO-20261126.sql` antes:
   o resumo deve dizer **PENDENTE**.
2. Contas a Receber → buscar `138` → abrir → **Receber** na parcela 6 (Residual).
3. Registrar: o botão "Confirmar Recebimento" estava **verde/habilitado** ou
   **acinzentado**? Os selects **Conta / Forma / Categoria** vinham vazios?
4. Preencher Conta (a mesma do parcial, conta 8), Forma **Dinheiro** e Categoria;
   manter o valor em **1.500,00** (valor menor geraria outro desdobramento).
5. Clicar **uma vez** em Confirmar e anotar o toast e se o modal fechou.
6. Rodar o mesmo SQL depois: o resumo deve dizer **PASS**.

**Hipótese principal para o no-op de 26/11:** o modal exige Conta + Forma +
Categoria; após recarregar a página esses três campos voltam vazios e o botão
fica acinzentado, sem aviso além da opacidade. Confirmar no passo 3.

**Esperado após o sucesso:** toast "Pagamento processado com sucesso!" (sem
"parcial"), modal fecha, parcela 6 `Quitado` com A Receber `R$ 0,00`, parcela 1
segue `Desdobrada`, contrato passa a recebido **3.000** / a receber **12.000**,
1 `payment` e 1 `financial_transactions` novos. O SQL valida tudo isso e o
cluster descartável (PG 18, porta 55433) já confirmou as duas saídas:
PENDENTE antes, PASS depois.

**Se der errado:** não estornar nada; guardar o toast/console e rodar o SQL para
ver até onde gravou.

### Resultado do teste 2 — PASSOU (26/11/2026)

Recebimento **integral** da residual 263 gravado pelo modal. Conferência do
`VERIFY-RESIDUAL-263-POS-RECEBIMENTO-20261126.sql` com resumo **`PASS`**:

| Item | Antes | Depois |
|---|---|---|
| Contrato 138 | recebido 1.500 / a receber 13.500 | **recebido 3.000 / a receber 12.000** |
| Residual 263 | `Aberto`, pago 0 | **`Quitado`, pago 1.500** |
| Original 258 | `Quitado`, pago 1.500 | inalterada (desdobrada) |
| `payments` da residual | 0 | **1 linha, 1.500** |
| Caixa da residual | 0 | **1 lançamento, 1.500** |
| Auditoria | — | **16838** `installments:263 UPDATE` (`Aberto -> Quitado`, `0 -> 1500`); **16839** `contracts:138 UPDATE` |

Todas as linhas com `organization_id = cf4c416b-...` e `ambiente = test`.

Conclusão: o fluxo de recebimento estava correto; o no-op de 26/11 foi falta de
preenchimento de Conta/Forma/Categoria no modal (botão desabilitado sem aviso),
não falha de RPC, trigger ou tenant. Melhoria sugerida para o front: mostrar
mensagem quando o botão estiver bloqueado por campos vazios.

---

## 6.5. Árvore de parcelas `1 → 1.1 → 1.1.1` (26/11/2026)

Decisões aprovadas: **banco + front**, **só parcelas novas** (sem backfill) e
**estorno bloqueado** com “Estorne a partir da última subparcela”. Plano completo
em `docs/PLANO-ARVORE-PARCELAS-20261126.md`; mockup aprovado em
`docs/mockups/parcelas-arvore.html` (Proposta A).

Banco — executado pelo usuário no SQL Editor de **test**:

- `FORWARD`: `colunas_novas = 2`, `linhas_vinculadas = 0`, `backup_rpc = 1`.
- `VERIFY`: todas as linhas `OK`; `resumo = PASS`; `sem backfill = OK — só
  parcelas novas`.
- `production` **não** foi tocada.

Código — `app/contas-a-receber/page.tsx` alterado (não comitado, não publicado):

- lê `installment_path`/`parent_installment_id` com fallback legado;
- ordena por raiz/filha (`1`, `1.1`, `1.1.1`, `2`, `2.1`, `3`);
- chip indentado, breadcrumb no mobile, badges `Desdobrada`/`Residual`/`Ativa`;
- “A Receber” mostra `—` com `saldo na X` nas parcelas com filha;
- `Estornar` desabilitado quando há filha, com aviso.

Validação: `npx tsc --noEmit` OK; `npx eslint` sem erros (1 warning pré-existente
em `receivableKpis`). `tsconfig.tsbuildinfo` restaurado.

Publicado: commit `c6e2fe3`, deploy `dpl_96YurBhHU6AErsCE5Jw8Y6KavLsG`
(**Ready**, alias `https://inove-juris.vercel.app`). Pendente: teste funcional de
novo desdobramento em `test` pelo usuário (`1 → 1.1 → 1.1.1` e bloqueio de
estorno na parcela com filha).

---

## 6.6. `permissions` como catálogo global — aplicado e validado (26/11/2026)

Correção do risco real da §6.1, executada sem tocar em dados:

- `lib/supabase.ts`: `permissions` removida de `TABELAS_COM_ORGANIZATION_ID` e
  acrescentada ao `if` de tabelas globais (early return).
- `lib/supabase-server.ts`: `permissions` acrescentada à allowlist global.
- `tsc` OK; `eslint` 0 erros e 0 warnings; `tsconfig.tsbuildinfo` restaurado.
- Commit `05f7dad`, deploy `dpl_A8MNTHZwwa7skQWB8gMEKXNWGYoP` (**Ready**, alias
  `https://inove-juris.vercel.app`).

Verificação `docs/VERIFY-PERMISSIONS-CATALOGO-GLOBAL-20261126.sql` (rodada pelo
usuário em `test`): `slugs_no_catalogo = 22`, `vinculos_test = 23`,
`permissoes_duplicadas_no_test = 0`, `vinculos_sem_slug = 0`, **PASS**.

Validação na tela: `/usuarios` em `test` mostra “Nenhum usuário encontrado” —
**esperado** (`users` 5/0 e `user_roles` 4/0; RLS por `organization_id = demo`).
O teste decisivo foi o modal **Novo Usuário → Perfil de Acesso (RBAC)**: ao
selecionar um perfil, os módulos são marcados automaticamente a partir dos
slugs. **Confirmado pelo usuário: funcionando.**

Nenhum `INSERT`/`UPDATE` em dados de negócio. A alternativa de duplicar o
catálogo no demo continua não recomendada e não foi executada.

**Teste 1 = OK**: claim ✅, `dados_isolados` ✅, `erro_console` ✅ e `permissions`
✅. Próximo: Teste 2 (configurações/backup/OAuth).

---

## 7. Ao voltar — próximos passos

1. ~~Confirmar se o código foi publicado/reiniciado~~ — **feito**: commit `49cfb21`, deploy aplicado.
2. ~~Logout e login novo em `test`~~ — **feito**; claim lido com a UUID demo.
3. ~~Rodar o diagnóstico do console do Teste 1~~ — **feito**: `organizacao_no_token` = demo.
4. ~~Fechar o Teste 1 com `dados_isolados` e `erro_console`~~ — **os três itens passaram**: claim ✅, `dados_isolados` ✅ (ver §6), `erro_console` ✅ (sem erros relatados em `test`/Contas a Receber). **Teste 1 = OK.** Confirmação formal de `/usuarios` e da lista de permissões dos perfis também fechada: ver §6.6 (modal Novo Usuário → Perfil de Acesso marca os módulos).
5. Se tudo fechar, **Teste 1 = OK** → seguir para Teste 2 (configurações/backup/OAuth);
   depois prazos, responsáveis legais, comissão e somente ao final recebimento/estorno/cancelamento.

### Retomada de amanhã (27/11) — parte de `permissions`

1. **Não executar nada em produção antes da decisão.** Nenhum `INSERT`/`UPDATE` em
   `permissions`/`role_permissions` sem autorização explícita e medição prévia.
2. Abrir `docs/PLANO-CORRECAO-PERMISSIONS-TENANT-20261126.md` e seguir a ordem:
   - primeiro o `VERIFY` somente-leitura para confirmar o comportamento da tela;
   - depois a correção de código (catálogo global), com `tsc`/`eslint`;
   - publicar em `main` e validar em `test` com logout/login novo.
3. Se o `erro_console` de hoje ainda não tiver sido fechado, fechá-lo antes de mexer
   em `permissions`.

**Não executar pagamentos, estornos ou cancelamentos até o Teste 1 fechar.**

---

## 8. Artefatos de apoio

### Documentação e planos

- `docs/PLANO-CORRECAO-PERMISSIONS-TENANT-20261126.md` (novo — retomada de amanhã)
- `docs/BACKUP-PRE-TENANT-20261126.md`
- `docs/MODELO-ESCOPO-AMBIENTE-TENANT-20261126.md`

### Verificações de diagnóstico

- `docs/VERIFY-TESTE-1-ISOLACAO-20261126.sql` (novo — `dados_isolados` do Teste 1)
- `docs/VERIFY-CADEIA-CONTRATO-138-TENANT-20261126.sql` (novo — cadeia + tenant)
- `docs/VERIFY-CADEIA-CONTRATO-138-INVESTIGA-20261126.sql` (novo — auditoria da residual)
- `docs/VERIFY-FINAL-ITEM-3-20261126.sql`
- `docs/VERIFY-USUARIOS-AMBIENTE-TENANT-20261126.sql`
- `docs/VERIFY-ORGANIZACOES-DEMO-20261126.sql`

### Rollbacks disponíveis

- `docs/ROLLBACK-GUARD-TENANT-TABELAS-FINANCEIRAS-20261126.sql`
- `docs/ROLLBACK-RPC-RECEBIMENTO-METODO-TENANT-20261126.sql`
- `docs/ROLLBACK-RPC-COMMISSION-TENANT-20261126.sql`
- `docs/ROLLBACK-RPC-GUARDIANS-TENANT-20261126.sql`
- `docs/ROLLBACK-RPCS-PRAZOS-TENANT-20261126.sql`
- `docs/ROLLBACK-SYSTEM-SETTINGS-PK-TENANT-20261126.sql`
- `docs/ROLLBACK-TRIGGER-ORG-20261126.sql`
- `docs/ROLLBACK-BACKFILL-LOTE-01..06-20261126.sql`
- `docs/ROLLBACK-CORRECAO-AMBIENTE-24-20261126.sql`
- `docs/ROLLBACK-LIMPEZA-BACKUPS-20261126.sql`

### Restrições lembradas

- Nenhum `UPDATE`/`DELETE` em dados de negócio sem autorização explícita.
- Nenhuma credencial no chat; senha apenas no terminal.
- Não colar conteúdo de dumps nem linhas completas de prévias.
- Não atualizar Supabase CLI de `2.75.0` para `v3.4.0`.
- Não comitar sem pedido explícito.
- Toda rotina declara/filtra/traz `environment`.

---

## 9. Pendências sem decisão formal

- Tenant completo / superadmin / break-glass.
- Chave ECC própria para assinatura do JWT.
- Multi-organização real (além de `production` + demo).
- Fundação RLS `_rls_organization_id()` e `_rls_test_shared()`.
- `get_auth_organization()` ainda lê `custom.organization_id`, não o claim JWT.
- Standby `c73f6852-eeca-455d-9549-647afae7e493` bloqueia importação.
- Restore 100% do backup em banco novo.

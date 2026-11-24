# Handoff final — 24/11/2026 (Contratos + performance)

> Documento de retomada, criado ao final da sessão. Tudo o que foi feito em
> 24/11/2026 está aqui resumido; os detalhes e as evidências brutas estão nos
> arquivos referenciados. `main`/`origin/main` em `7c345cd`.
>
> **Estado geral: FECHADO.** Auditoria de Contratos encerrada, P0/P1 aplicados e
> validados, investigação de lentidão encerrada com causa confirmada por medição.
> Nenhuma célula de SQL está pendente de execução. Nenhum rollback foi aplicado.

## 1. Regras que valem para a próxima tarefa

1. **Somente o usuário executa SQL no Supabase**, no SQL Editor. O agente não
   executa banco, não usa service role e não pede credenciais no chat.
2. **Nada é aplicado sem autorização explícita** e sem medição prévia. Medir,
   provar com dados, preparar forward/verify/rollback, pedir autorização, aplicar.
3. **Nenhum `UPDATE`/`DELETE` em dados de negócio** em nenhuma hipótese. Todas
   as mudanças foram DDL (policies, views, funções, índices, constraint).
4. **SQL completo em uma única célula.** Nunca entregar saída parcial pedindo
   colagem de células avulsas.
5. `GEMINI_API_KEY` é a única fonte autorizada da chave Gemini; nunca aceitar
   chave manual/fallback do navegador.
6. Conclusões vêm de medição, não de percepção. Se uma hipótese não foi medida,
   ela continua sendo hipótese — não vira mudança.
7. `CREATE INDEX CONCURRENTLY` **não funciona** no SQL Editor (roda em transação;
   erro `25001`). Usar `CREATE INDEX` comum e conferir duplicatas antes.

## 2. Auditoria de Contratos — fechada

Script consolidado: `docs/AUDITORIA-CONTRATOS-COMPLETA-20261124.sql`, célula
única `auditoria_contratos_completa`, executada às
`2026-11-24T18:01:50.243675+00:00`. Resultado em
`docs/VALIDACAO-CONTRATOS-RESULTADO-20261124.md`.

| Achado | Resultado | Decisão |
|---|---|---|
| “17 totais inconsistentes” | 44/44 totais explicados pela fórmula real do trigger; eram falso positivo | sem correção |
| 26 parcelas com `amountPaid > amount` | `pago == SUM(payments)` nos 26; `interest=0`, `fine=0`; nenhum com transação vinculada | **entrada real**; não reduzir `amountPaid` |
| 9 pagamentos sem conta | 5 com transação, 0 com conta nela; 4 sem transação; candidatas por valor/data ambíguas e em `test` | irrecuperável; não inferir conta |

Hipótese juros/multa refutada. `CHECK (amountPaid <= amount)` foi **retirado do
roadmap**: rejeitaria pagamentos válidos com acréscimo embutido. Nenhum
`UPDATE`/`DELETE` foi escrito; auditoria inteiramente somente leitura.

## 3. Correções estruturais P0/P1 — aplicadas e validadas

- **Medição prévia:** 18:15:48 UTC (`docs/MEDICAO-P0-P1-CONTRATOS-20261124.sql`)
  e 18:18:20 UTC (`docs/MEDICAO-COMPLEMENTAR-P0-20261124.sql`).
  `duplicatas_parcelas=0`; colunas reais confirmadas; assinatura de
  `search_all(p_term text, p_environment text DEFAULT NULL)`.
- **P0 — 18:24:54 UTC:** `docs/FORWARD-P0-CONTRATOS-20261124.sql` +
  `docs/FIX-P0-SEARCH-ALL-20261124.sql` + `docs/VERIFY-P0-CONTRATOS-20261124.sql`.
  Policies do portal com `_rls_can_access(environment) AND (predicado original)`;
  3 views de dashboard excluindo `Estornado`; `search_all` reparado
  (`contractNumber`, `clientId` e `processes.processNumber` removidos, uso de
  `to_jsonb`). O `VERIFY` inicial encontrou `processes.processNumber` quebrado —
  corrigido no mesmo passo.
- **P1 — 18:29:06 UTC:** `docs/FORWARD-P1-CONTRATOS-20261124.sql` +
  `docs/VERIFY-P1-CONTRATOS-20261124.sql`. `UNIQUE(contract_id,
  "installmentNumber")` ativa; 8 índices presentes, 0 inválidos, 0 duplicatas.
  Primeira tentativa falhou com `25001` (`CONCURRENTLY`); nada foi aplicado
  parcialmente.
- **Efeito nos KPIs:** production inalterado (18 inadimplentes / R$ 77.931,60);
  test caiu de 7 para 5 inadimplentes e de R$ 19.000,00 para R$ 14.000,00;
  `top_defaulters` 22 → 21 linhas e R$ 96.931,60 → R$ 91.931,60; forecast
  inalterado (7 linhas / R$ 24.044,20). As 3 parcelas `Estornado` continuam no
  banco.
- **Contagens estáveis em todas as verificações:** `contracts=125`,
  `installments=181`, `payments=177`, `commission_payments=15`.
- Rollbacks `ROLLBACK-P0` e `ROLLBACK-P1` existem e **não foram aplicados**.

## 4. Investigação de lentidão — fechada com causa confirmada

### 4.1 Linha do tempo (UTC, 24/11/2026)

| Hora | Acontecimento |
|---|---|
| 18:40:45 | Benchmark prévio (`BENCHMARK-POS-P0-P1`): RLS por linha é a causa; `to_jsonb` refutado |
| 18:44:42 | Prova `BENCHMARK-RLS-INIPLAN`: `(select _rls_can_access(null))` confirmado |
| 18:47:25 | `FORWARD-RLS-INIPLAN` aplicado: 47 policies + portal em `clients` (`EXISTS` → `IN`) |
| 18:51:19 | `FIX-RLS-INIPLAN-REMANESCENTES` aplicado: 8 policies restantes; verify 55 InitPlan, 0 diretas |
| 18:52:52 | Benchmark pós-RLS: tabelas centrais ~1 ms; resíduo de 13,7 ms em `clients` |
| 18:55:50 | Diagnóstico do portal: 125 chamadas por linha de `_rls_portal_indicator_id()`; `IN` ≈ `EXISTS` |
| 18:58:19 | Prova `BENCHMARK-PORTAL-INIPLAN`: InitPlan no portal; onboarding sem ganho |
| 19:01:01 | `FORWARD-PORTAL-INIPLAN` aplicado; verify 4 policies convertidas |
| 19:02:51 | Benchmark final: medição de encerramento |

### 4.2 Causa e hipóteses

- **Causa raiz confirmada:** RLS avaliada por linha. Primeiro
  `_rls_can_access(environment)` em todas as tabelas de domínio; no resíduo,
  `_rls_portal_indicator_id()` no filtro da policy do portal (125 chamadas).
- **Correção:** trocar a chamada direta por `(select public._rls_can_access(null))`
  e `(select public._rls_portal_indicator_id())`. Funções `STABLE` → valor é o
  mesmo dentro do statement; plano vira `InitPlan 1` com `Actual Loops: 1`.
- **Refutadas com medição:** `to_jsonb` do `search_all` (11,0 × 11,9 ms; depois
  1,146 × 2,069 ms) e `IN` vs `EXISTS` na policy de `clients` (13,464 × 13,604 ms).
  Onboarding `_rls_onboarding_client_id()` ficou de fora: 0,125 → 0,149 ms, sem ganho.
- **Não houve deploy** nesta rodada; o bundle do app é o mesmo desde o P2 de 23/11.

### 4.3 Provas e verificações

| Verificação | Resultado |
|---|---|
| `BENCHMARK-RLS-INIPLAN` (18:44:42) | `payments` 111,542 → 1,026 ms; `contracts` 79,464 → 0,960 ms; `clients` 71,753 → 0,920 ms |
| `VERIFY-RLS-INIPLAN` (18:51:19) | `policies_total=63`; 55 com InitPlan; 0 forma direta; 0 argumento coluna; `restantes=[]` |
| `BENCHMARK-PORTAL-INIPLAN` (18:58:19) | portal `clients` 14,084 → 0,328 ms; `contracts` 13,913 → 0,286 ms; `commission_payments` 1,700 → 0,241 ms |
| `VERIFY-PORTAL-INIPLAN` (19:01:01) | 4 policies com InitPlan; 0 chamada direta; `restantes=[]` |
| Planos | `InitPlan 1`, `Actual Loops: 1`, filtro `(indicator_id = (InitPlan 1).col1)`; forma anterior com `Rows Removed by Filter: 125` |

Em todos os verify: contagens `125/181/177/15` e `search_all('ana','production')`
com 5 clientes + 5 contratos, inalteradas.

### 4.4 Benchmark final — 19:02:51.094396 UTC

`docs/BENCHMARK-POS-P0-P1-20261124.sql`, PG 17.6, role `authenticated`,
`production`, 1 sessão ativa, 5 repetições.

| Série | Antes (18:40:45) | Pós-RLS (18:52:52) | **Final** | Ganho total |
|---|---:|---:|---:|---:|
| `clients` | 163,286 | 13,720 | **2,071 ms** | ~79× |
| `installments` | 114,463 | 1,071 | **1,037 ms** | ~110× |
| `payments` | 111,596 | 1,072 | **1,023 ms** | ~109× |
| `vw_receivables_metrics` | 113,487 | 1,150 | **1,062 ms** | ~107× |
| `vw_top_defaulters` | 103,475 | 15,644 | **3,872 ms** | ~27× |
| `contracts` | 78,985 | 0,941 | **0,930 ms** | ~85× |
| `vw_receivables_forecast` | 21,697 | 0,898 | **0,826 ms** | ~26× |
| `processes` | 10,245 | 0,707 | **0,708 ms** | ~14,5× |
| `commission_payments` | 9,632 | 0,753 | **0,700 ms** | ~14× |
| `search_all('ana','production')` | 81,822 | 21,253 | **9,131 ms** | ~9× |

`search_all` final é **9,131 ms** (não ~3 ms); custo de RLS 6,549 ms
(9,131 com RLS × 2,582 sem RLS). Custo residual não atribuído a uma única causa;
não justifica nova mudança sem medição específica.

`_auth_session_payload` falha com `permission denied for function
_auth_session_payload` porque o benchmark roda como `authenticated`; artefato
pré-existente do script, sem impacto nas demais séries. O app usa
`app_validate_session`, que funciona (0,810 ms no benchmark final).

## 5. Inventário de scripts (todos em `docs/`)

| Arquivo | Estado |
|---|---|
| `AUDITORIA-CONTRATOS-COMPLETA-20261124.sql` | Executado (18:01:50) |
| `VALIDACAO-CONTRATOS-20261124.sql` | Executado (17:51:38) |
| `INVESTIGACAO-EXCESSO-26-20261124.sql` | Executado (~17:58) |
| `DIAGNOSTICO-CONTRATOS-20261124.sql`, `FORENSE-CONTRATOS-20261124.sql` | Executados |
| `MEDICAO-P0-P1-CONTRATOS-20261124.sql` | Executado (18:15:48) |
| `MEDICAO-COMPLEMENTAR-P0-20261124.sql` | Executado (18:18:20) |
| `FORWARD-P0-CONTRATOS-20261124.sql` | **Aplicado** |
| `FIX-P0-SEARCH-ALL-20261124.sql` | **Aplicado** |
| `VERIFY-P0-CONTRATOS-20261124.sql` | Executado |
| `ROLLBACK-P0-CONTRATOS-20261124.sql` | Disponível, **não aplicado** |
| `FORWARD-P1-CONTRATOS-20261124.sql` | **Aplicado** (após correção `25001`) |
| `VERIFY-P1-CONTRATOS-20261124.sql` | Executado |
| `ROLLBACK-P1-CONTRATOS-20261124.sql` | Disponível, **não aplicado** |
| `BENCHMARK-POS-P0-P1-20261124.sql` | Executado 3× (18:40:45, 18:52:52, 19:02:51) |
| `BENCHMARK-RLS-INIPLAN-20261124.sql` | Executado (18:44:42) |
| `FORWARD-RLS-INIPLAN-20261124.sql` | **Aplicado** (18:47:25) |
| `FIX-RLS-INIPLAN-REMANESCENTES-20261124.sql` | **Aplicado** (18:51:19) |
| `VERIFY-RLS-INIPLAN-20261124.sql` | Executado (18:51:19), versão corrigida |
| `ROLLBACK-RLS-INIPLAN-20261124.sql` | Corrigido, disponível, **não aplicado** |
| `BENCHMARK-PORTAL-CLIENTS-20261124.sql` | Executado (18:55:50) |
| `BENCHMARK-PORTAL-INIPLAN-20261124.sql` | Executado (18:58:19) |
| `FORWARD-PORTAL-INIPLAN-20261124.sql` | **Aplicado** (19:01:01) |
| `VERIFY-PORTAL-INIPLAN-20261124.sql` | Executado (19:01:01) |
| `ROLLBACK-PORTAL-INIPLAN-20261124.sql` | Disponível, **não aplicado** |

Nenhuma grant nova, nenhuma função nova, nenhuma escrita em dados de negócio.

## 6. Commits desta rodada (todos em `main`, pushed)

- `de19564` auditoria consolidada; `0b4fd5f` fechamento da auditoria.
- `f3ce66e` → `84a03c9` → `73cee47` preparação/correção/fechamento P0/P1.
- `e29066e` → `8f9aa36` → `f3e888c` → `62c7c57` → `ff2131c` benchmark,
  prova, forward, fix e verify do InitPlan de RLS.
- `4ebdded` → `6ef2885` benchmark pós-fix e diagnóstico do portal.
- `7a3c425` → `ed522d6` preparação/aplicação e verify do InitPlan do portal.
- `7c345cd` benchmark final e encerramento (**HEAD atual**).

## 7. Pendências para a próxima tarefa

**Nenhuma pendência de SQL ou de banco desta rodada.** Rollbacks ficam arquivados
e não devem ser aplicados sem decisão explícita.

Se o próximo trabalho tocar performance novamente:

1. Começar pelo benchmark final `19:02:51` (não pelo de 18:52:52).
2. `search_all` é o único número que ainda chama atenção (9,131 ms); qualquer
   mudança exige medição prévia específica. `to_jsonb` já está refutado.
3. Não reabrir `_rls_onboarding_client_id()` — medido sem ganho.
4. Não usar `CREATE INDEX CONCURRENTLY` no SQL Editor.

Outras pendências **preexistentes** (fora do escopo desta rodada), registradas em
`docs/STATUS-INOVEJURIS.md` e `supabase/migrations/STATUS_SEGURANCA.md`:

- F4b-2c: remover policies `USING (true)` depende da identidade completa; sozinha
  derrubaria acesso a clientes, prazos, publicações, contratos e financeiro.
- Chave ECC própria: standby `c73f6852-eeca-455d-9549-647afae7e493` precisa ser
  marcada como `previously_used`/revogada antes da importação.
- `organization_id`/multitenancy: adiado, plano em
  `docs/PLANO-ROTACAO-ECC-E-MULTITENANCY-20261123.md`.

## 8. Ordem de leitura para retomar rápido

1. Este arquivo (`docs/HANDOFF-FECHAMENTO-20261124.md`).
2. `docs/HANDOFF-P0-P1-CONTRATOS-20261124.md` — detalhe das correções P0/P1 e
   de toda a investigação de performance, incluindo o benchmark final.
3. `docs/VALIDACAO-CONTRATOS-RESULTADO-20261124.md` — auditoria 26/44/9.
4. `docs/STATUS-INOVEJURIS.md` — status global do projeto.
5. Os `.sql` da tabela do item 5, somente se uma nova medição/mudança for
   autorizada explicitamente.

# Otimização de performance — 23/11/2026

Diagnóstico e execução em lotes, autorizados pelo usuário. Ordem acordada:
P0.2 + P0.3 → P0.1 → P1.1; na retomada: P1.2 → P1.3 → P2 (parcial).
Banco/RLS: P1.1 aplicado, validado e mantido em 23/11/2026 — detalhes abaixo.

## Diagnóstico (auditoria somente leitura)

1. `useAuth()` era um hook com bootstrap próprio: cada instância chamava
   `postAuth('validate')`. Eram **42 chamadas** no projeto e **11 só no Dashboard**.
2. O Dashboard fazia **12 queries** no load, das quais **5 nunca eram usadas**
   (`products`, `law_areas` e 3 views de recebíveis), além de loops `.find()`
   aninhados (O(n²)) para cruzar contratos/processos/clientes.
3. A cadeia Gemini chegava a **~24 chamadas HTTP** por ação: 4 modelos ×
   2 tentativas da app × 3 retries internos do SDK (`maxRetries=2`).
4. RLS com `_auth_session_payload()` VOLATILE — resolvido no P1.1 (STABLE +
   helper booleano enxuto). Índices em `user_sessions` descartados por medição.
   Cache-Control de signed-url (P1.2) e bundle (P2) concluídos.

> Nota: `AIInsightsWidget` chama `/api/ai/generate` no mount, mas **não está
> montado em nenhuma página**. O "Parecer Estratégico" do Dashboard é local,
> baseado em regras — não consome Gemini.

## Lote 1 — Gemini enxuto + Dashboard (concluído)

- Commit `9e14ec9`, deploy `dpl_6ascdy9cbHBZDxyephouP3BQUDnj` — `READY`.
- `lib/gemini-server.ts`:
  - `createGeminiClient()` com `httpOptions.retryOptions.attempts = 1`
    (desliga os retries internos) e timeout de 15 s por requisição.
  - `withGeminiModelFallback()` tenta **cada modelo uma vez**, com prazo total
    compartilhado de 25 s (`AbortSignal.timeout`). Antes: 2 tentativas por modelo.
  - `friendlyGeminiError()` traduz abort/timeout em `GEMINI_TIMEOUT`; a rota devolve **504**.
- `app/page.tsx`:
  - 12 → 7 queries; colunas explícitas no `select`; apelido `performer:` preservado.
  - Maps em memória (`contractsById`, `contractsByProcessNumber`, `clientsById`)
    no lugar de `.find()` repetidos; mesmos maps usados no mapeamento de prazos.
  - Marcadores de memo com dependências ajustadas para os novos maps.

## Lote 2 — AuthProvider único (concluído)

- Commits `3af03fa` (rename `lib/auth.ts` → `lib/auth.tsx`) e `786f73f`
  (conteúdo do provider + layout). Deploy `dpl_4TxPiTGXA2bZ3oWh8P6tAgMsNEwF` — `READY`.
- `AuthProvider` montado uma vez no layout raiz; `useAuth()` agora lê contexto
  (11 validações → 1). Ações (`login`, `logout`, `refreshUser`, etc.) passaram a
  `useCallback`, estabilizando os listeners do `SessionMonitor`.
- Comportamento preservado: rotas públicas (`/login`, `/onboarding/*`,
  `/portal/indicador/*`) continuam sem bootstrap; login/logout/troca de ambiente
  ainda fazem navegação completa, que remonta o provider.

## Validação dos lotes P0 (23/11/2026)

- `/login` → `200`; `/configuracoes` sem cookie → `307` para `/login`.
- Dashboard desktop: console sem erros; **1** `POST /api/auth/session`
  (`{"action":"validate"}`) — antes eram 11; **7 queries** no load — antes 12.
- Troca de ambiente PRODUÇÃO → TESTE → PRODUÇÃO OK; após reload,
  `data-env=production`.
- Achados preexistentes (não são regressão do P0): `GET /rest/v1/system_settings`
  retorna `401` e gera `Error fetching settings:`; em `/usuarios`, a consulta de
  `user_roles` falha com `42501 permission denied`, deixando a lista vazia e sem
  botão de impersonação. Ambos dependem de grants/RLS (F4b).
- Ainda pendente de validação pelo usuário: logout, salvar permissão em
  `ProfilesTab`, upload/IA em Marketing, impersonação e conferência no iPhone.

## Lote P1.2 — Cache-Control em signed-url (concluído)

- Commit `ff26318`, deploy `dpl_3yF4XDj6NzB8QdqFcTG9v632GxAR` — `READY`.
- JSON de `/api/storage/signed-url`: `private, max-age=300, must-revalidate`.
- Redirect (`?redirect=1`): `private, no-store`, para não guardar URL assinada antiga.

## Lote P1.3 — DJEN em lotes (concluído)

- Mesmo commit/deploy do P1.2.
- `insert` + updates individuais substituídos por `upsert` em lotes de 200 pela
  chave única `(source, external_id, environment)`.
- Payload só com campos de fonte: `status`, decisão, responsável, leitura, prazo
  e importância continuam sob controle humano.
- Contadores `inserted`/`updated` mantidos, agora derivados do estado anterior.

## Lote P2 — parcial (concluído o que era seguro)

- Commit `3934c0c`: `after()` de `next/server` fecha `publication_sync_log` fora
  do caminho da resposta, no sucesso e na falha.
- Commit `ef1d26e`, deploy `dpl_HRFVC5g5JHaQzHjkhd6bD34ePieA` — `READY`.
- Gráficos do Dashboard movidos para `components/dashboard/DashboardCharts.tsx`
  e carregados com `next/dynamic` (`ssr: false`). First Load JS de `/`:
  **556 kB → 431 kB**. Os quatro `DeferredBlock`s e seus placeholders foram
  preservados no novo módulo.

## Estado final e pendências

- **P1.1 (banco/RLS) — CONCLUÍDO E MANTIDO.**
  - Diagnóstico em produção (PG 17.6, role `authenticated`):
    `_auth_session_payload` era **VOLATILE**; `_rls_session_valid`,
    `_rls_can_access`, `_auth_user_payload` e `get_auth_organization()` já eram
    **STABLE**.
  - `get_auth_organization()` existe, lê `custom.organization_id` e não foi
    alterada. A policy legada `"Isolamento por Organização em users"` segue
    intacta. Nenhuma policy, grant ou role foi alterado.
  - Índices em `user_sessions` **fora do plano**: 207 linhas e `Seq Scan` de
    0,163 ms não justificam custo de escrita.
  - Apply executado pelo usuário; validação funcional passou (sem token →
    `false`, com token → `true`, environment errado → `false`,
    `app_validate_session` → `true`).
  - Alerta de Disk IO Budget investigado: hit ratio 100%, 2.299 `blks_read` no
    total, `read_ms`/`write_ms`/`evictions` zerados; top por blocos lidos são
    exports `COPY ... TO stdout` e DDL do Realtime, servidos por cache. Alerta
    foi transitório e **não** motivou rollback.
  - Uma amostra sem sessão ativa foi descartada (`sessao_encontrada = false`).
  - Medição final com 5 repetições e sessão ativa:

    | Métrica | Baseline | Mediana | Resultado |
    |---|---:|---:|---|
    | `_auth_session_payload` | 2,625 ms | 0,652 ms | ~4× melhor |
    | `_rls_can_access` | 2,106 ms | 0,868 ms | ~2,4× melhor |
    | `app_validate_session` | 1,820 ms | 0,786 ms | ~2,3× melhor |
    | `processes` com RLS | 10,949 ms | 10,129 ms | estável |
    | `clients` com RLS | 110,732 ms | 165,010 ms | pior — frente separada |

  - **Decisão:** manter o apply. Rollback não aplicado. Handoff em
    `docs/HANDOFF-P1-1-20261123.md`.
  - **Próxima frente:** estabilizar `clients` com RLS. A causa apontada é
    `_rls_can_access(environment)` ser avaliado por linha nas policies; mudança
    exige replanejamento e nova autorização.
- **Streaming de backup (P2):** mantido como não executado. O anexo de e-mail
  precisa do zip completo em memória e os logs de auditoria/`backup_status` hoje
  são gravados antes da resposta; passar a stream + `after()` troca esse contrato
  por um risco desproporcional numa rota administrativa crítica.

Não executar nada de banco sem autorização e sem medição prévia.

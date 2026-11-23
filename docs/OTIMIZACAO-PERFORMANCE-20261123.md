# Otimização de performance — 23/11/2026

Diagnóstico e execução em lotes, autorizados pelo usuário. Ordem acordada:
P0.2 + P0.3 → P0.1 → P1.1. Nada de banco/RLS foi alterado.

## Diagnóstico (auditoria somente leitura)

1. `useAuth()` era um hook com bootstrap próprio: cada instância chamava
   `postAuth('validate')`. Eram **42 chamadas** no projeto e **11 só no Dashboard**.
2. O Dashboard fazia **12 queries** no load, das quais **5 nunca eram usadas**
   (`products`, `law_areas` e 3 views de recebíveis), além de loops `.find()`
   aninhados (O(n²)) para cruzar contratos/processos/clientes.
3. A cadeia Gemini chegava a **~24 chamadas HTTP** por ação: 4 modelos ×
   2 tentativas da app × 3 retries internos do SDK (`maxRetries=2`).
4. Pendente: RLS com `_auth_session_payload()` VOLATILE avaliada por linha,
   índices em `user_sessions`, Cache-Control de signed-url (P1) e bundle (P2).

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

## Validação pendente (quando retomar)

- [ ] Abrir Dashboard no desktop e no iPhone e conferir carregamento/console.
- [ ] Login, logout, troca de ambiente e "Assumir usuário" (impersonação).
- [ ] `ProfilesTab` → salvar perfil (usa `refreshUser`).
- [ ] IA: enviar imagem em Configurações → Marketing → Nova Arte e testar sugestão.
- [ ] Confirmar que `/login` responde `200` e `/configuracoes` sem cookie responde `307`.

## Ainda não executado (aguarda decisão)

- **P1.1 (banco, risco médio):** marcar `_auth_session_payload()` como `STABLE`,
  extrair helper booleano leve para `_rls_can_access`, índices em `user_sessions`,
  e medir com `EXPLAIN (ANALYZE, BUFFERS)` antes/depois. Conferir em produção a
  função `get_auth_organization()` (referenciada em policy legada de `users`,
  sem definição no repositório). Não reaplizar scripts `fix_*_rls.sql`.
- **P1.2:** `Cache-Control` nas URLs assinadas (`app/api/storage/signed-url/route.ts`).
- **P1.3:** `upsert` no sync e lotes no DJEN (`app/api/djen-sync/route.ts`).
- **P2:** `next/dynamic` para Recharts/motion, DJEN em background, streaming de backup.

Não executar nada de banco sem autorização e sem medição prévia.

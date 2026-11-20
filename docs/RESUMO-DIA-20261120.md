# InoveJuris — Fechamento do dia 2026-11-20

> Documento consolidado de tudo que foi entregue, validado e deixado pendente nesta data.
> Para continuidade, use este arquivo junto com `docs/STATUS-INOVEJURIS.md` e
> `docs/HANDOFF-PENDENCIAS-20261120.md`.

---

## 1. Estado final do repositório e publicação

| Item | Valor |
|---|---|
| Branches | `fase0-seguranca`, `main`, `trabalho-com-claude` **alinhadas** |
| Commit final | `23cdc1a` (documentação) |
| Commit de código mais recente | `f016df4` (ordem dos lançamentos) |
| Último deploy | **`dpl_H9nD3nV1FXH9vSXVq6aZ9rsKegZT`** — `READY`, `target=production` |
| Alias de produção | `https://inove-juris.vercel.app` |
| CLI Vercel | autenticada como `alcantarus`; projeto `prj_P2N8gl98SzR1SCUKOe0sABB3ika8` |
| `git status` | limpo ao final do dia |

### Deploys do dia (em ordem cronológica)

| Deploy | Conteúdo |
|---|---|
| `dpl_G1MthzfBKKgh76ToAVFQ2bN5vXXf` | injeção do JWT corrigida em `lib/supabase.ts` (`c4d806c`) |
| `dpl_4LKhoEm2NjjKWJ4AHvCT7QLzKM1D` | Fase B — `SUPABASE_JWT_ROLE=authenticated` |
| `dpl_CKcrymP74sp29R5FiQbpifjntjVf` | correção da digitação lenta em Movimentações (`85dc94b`) |
| `dpl_7a86NJWEyxK7YRoBdfYmJaSToJQL` | Dashboard reorganizada e otimizada (`41f0191`) |
| `dpl_GQe4b6y6m1jeeGDnnF13wE6ZhoBC` | isolamento de ambientes nas RPCs (`c29dc84`) |
| `dpl_H9nD3nV1FXH9vSXVq6aZ9rsKegZT` | ordem cronológica dos lançamentos (`f016df4`) — **atual** |

---

## 2. Entregas do dia

### 2.1 — Digitação lenta em `/fluxo-caixa/movimentacoes`
- **Causa:** filtro/ busca recalculava a lista inteira a cada tecla; `Intl.NumberFormat` recriado por render.
- **Correção:** componente memoizado, `useMemo` e formatador reaproveitado.
- **Resultado medido:** **15.765 ms → 1.119 ms (~14× mais rápido)**.
- Parecer: `C:\InoveTecnologia\InoveJuris-Backups\PERF-20261120\PARECER-DIGITACAO-LENTA-20261120.md`.

### 2.2 — Dashboard mais rápida e organizada
- **Diagnóstico:** 10.236 px de altura, 50 cards, 18 gráficos, 30 chamadas REST no load (12 levando 1,2–2,0 s), long tasks de 175/139/104 ms ao trocar filtro.
- **Correção:** debounce de 400 ms no Realtime, `useMemo`, `React.memo`, `DeferredBlock` com `IntersectionObserver`, grades 4×2 / 3×2 / 2 colunas, 6 seções com âncoras e título duplicado removido.
- Parecer e originais: `C:\InoveTecnologia\InoveJuris-Backups\DASHBOARD-20261120\`.

### 2.3 — Isolamento Produção × Teste em Movimentações
- **Sintoma:** cards e gráficos idênticos nos dois ambientes.
- **Causa:** três RPCs com `p_environment: 'production'` fixo em `app/fluxo-caixa/movimentacoes/page.tsx`; o Proxy de `lib/supabase.ts` isola tabelas, mas **não intercepta RPCs**.
- **Prova por consulta somente leitura:** produção = 168.496,57 / 100.114,61 (179 entradas, 811 saídas); teste = 35.600,00 / 600,00 (43 entradas, 4 saídas). **Não havia duplicação nem corrupção de dados.**
- **Correção:** `getAppEnv()` nas três RPCs. Produção inalterada; teste passa a exibir 35.600,00 / 600,00 / 35.000,00.
- Parecer e SQL de conferência: `C:\InoveTecnologia\InoveJuris-Backups\ENV-20261120\`.

### 2.4 — Ordem cronológica dos lançamentos
- **Sintoma:** lançamentos do mesmo dia em ordem arbitrária.
- **Causa:** ordenação só por `date` (DATE, sem hora) — todos os lançamentos do dia empatavam. `created_at` (TIMESTAMPTZ) e `id` (IDENTITY) já existiam e não eram usados.
- **Correção:** `.order('date', false).order('created_at', false).order('id', false)` em `movimentacoes/page.tsx` e `fluxo-caixa/page.tsx`.
- **Banco de dados intacto:** nenhuma tabela, coluna, índice ou dado alterado. Índice `(environment, date DESC, created_at DESC, id DESC)` ficou apenas como opção futura de desempenho, **não executado**.
- **Resultado esperado:** Corte de Cabelo / Dinho → Pagto Painho Mega Sena → Mega Sena Anderson → Mega Sena de Painho.
- Parecer e originais: `C:\InoveTecnologia\InoveJuris-Backups\ORDEM-20261120\`.

### 2.5 — Segurança (Fase A e Fase B, conclusão registrada)
- JWT próprio com HS256 (`SUPABASE_JWT_SECRET`) como ponte; BFF descartado em `docs/PARECER-JWT.md`.
- Fase A (`role=anon`) e Fase B (`role=authenticated`) publicadas e validadas; variáveis presentes em Production/Preview/Development.
- **Autenticação não alterada:** heartbeat de 20 s, `app_validate_session` e tolerância de 90 s intactos.
- Nenhuma implementação de tenant foi autorizada ou executada.

---

## 3. Validações feitas

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | sem erros (após cada entrega) |
| `npm run build` | OK — 45 s (dashboard), 32,6 s (ordem) |
| `tsconfig.tsbuildinfo` | restaurado após cada build |
| SQL de conferência de ambientes | executado pelo usuário no SQL Editor; números conferem |
| Deploys | todos `READY` e com alias de produção atualizado |

---

## 4. Pendências para a próxima sessão

### Validações visuais — CONCLUÍDAS E CONFIRMADAS pelo usuário em 2026-11-20
1. ✅ Ambiente de teste exibindo **35.600,00 / 600,00 / 35.000,00** (isolamento das RPCs correto).
2. ✅ Lista de Movimentações na ordem: **Corte de Cabelo / Dinho → Pagto Painho Mega Sena → Mega Sena Anderson → Mega Sena de Painho** (ordem cronológica inversa correta).

> Observação operacional: o navegador integrado perde a sessão e redireciona para `/login`; credenciais não são manuseadas no chat. As validações foram feitas pelo usuário em seu navegador.

### Segurança — adiadas por decisão explícita do usuário
- **F4b-2c** — dropar as policies `USING (true)`; depende de identidade completa.
- **Chave ECC própria (ES256)** — standby `c73f6852-eeca-455d-9549-647afae7e493` precisa ser marcada como `previously_used`/revogada.
- **F3** — ~17 funções `http*`/`urlencode` pertencem a `supabase_admin`; `postgres` não consegue revogar; depende de chamado ao Supabase Support. Pacote em `C:\InoveTecnologia\InoveJuris-Backups\F3-20261118\SUPPORT-REQUEST.md`.
- **Teste de pagamento/estorno** — efeito financeiro real, somente com autorização explícita.
- Detalhes completos: `docs/HANDOFF-PENDENCIAS-20261120.md`.

### Riscos residuais conhecidos
- Policies `USING (true)` ainda liberam leitura pela chave publicável; o JWT é enviado, mas ainda não filtra por tenant.
- Assinatura HS256 é ponte provisória.
- Logs de runtime da Vercel não retidos no plano Hobby (`recordsReturned=0`).
- Views sem coluna `environment` ainda não filtram ambiente no banco (KPIs podem misturar ambientes).

---

## 5. Rollback — pontos de restauração

| Situação | Ação |
|---|---|
| Ordem dos lançamentos | `git revert f016df4` ou restaurar `ORDEM-20261120\*.orig.tsx` |
| Isolamento das RPCs | `git revert c29dc84` |
| Dashboard | promover `dpl_CKcrymP74sp29R5FiQbpifjntjVf`; `git revert 41f0191`; restaurar `DASHBOARD-20261120\app-page.orig.tsx` |
| Digitação lenta | promover `dpl_7a86NJWEyxK7YRoBdfYmJaSToJQL`; `git revert 85dc94b` |
| JWT / identidade | remover `SUPABASE_JWT_SECRET` e `SUPABASE_JWT_ROLE` na Vercel e republicar; promover `dpl_3Z5EZi41FQPWPSZsviw2SLfyM6fs` |
| Deploy imediatamente anterior ao atual | `dpl_GQe4b6y6m1jeeGDnnF13wE6ZhoBC` |

Nenhuma mudança de banco foi feita nas entregas 2.3 e 2.4.

---

## 6. Referências

- `docs/STATUS-INOVEJURIS.md` — documento mestre, histórico completo.
- `docs/HANDOFF-PENDENCIAS-20261120.md` — pendências de segurança adiadas.
- `docs/PARECER-JWT.md` — JWT próprio × BFF.
- `C:\InoveTecnologia\InoveJuris-Backups\` — pareceres, originais, SQLs de forward/rollback e evidências (pastas `PERF-20261120`, `DASHBOARD-20261120`, `ENV-20261120`, `ORDEM-20261120`, `FASE0-20261119`, `F3-20261118` e outras).

**Encerramento:** tudo salvo e versionado em 2026-11-20. As duas validações visuais da seção 4 foram **concluídas e confirmadas pelo usuário no mesmo dia** — todas as entregas do dia estão fechadas. Retomar amanhã somente se houver novo trabalho ou decisão sobre as pendências de segurança adiadas.

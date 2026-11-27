# Handoff — consolidação de 27/11/2026

> **Regra permanente:** existe **um único banco**; `production` e `test` são
> valores de `environment`, não databases separados
> (`docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`).
> Nenhum SQL foi executado pelo agente — você rodou tudo no SQL Editor e colou
> os resultados.
> **Atualizado em 27/11 após o reteste do console. Commit `fab1218` pushed;
> deploy Vercel `success`.**

---

## 1. Estado geral (fechado em 27/11)

- **Teste 1 = OK (reteste final)**: claim ✅ em `production` e `test`,
  `dados_isolados` ✅, `erro_console` ✅ (sem 400), `permissions` ✅
  (catálogo global).
- **Teste 2 (configurações/backup/OAuth)** — ainda não iniciado.
- **Árvore de parcelas** aplicada só para parcelas novas (sem backfill).
- **KPI `A Receber`** corrigido no front e no banco; 15 contratos ajustados.
- **Estorno / desdobramento**: regra unificada (A) aplicada e testada com sucesso.
- **UI**: modais responsivos no iPhone, status de parcela no feminino e
  digitação sem re-render da página (estorno e recebimento isolados).

Último deploy: commit `fab1218` — Vercel **success** (*Deployment has
completed*), status publicado no commit. Alias `https://inove-juris.vercel.app`.
`HEAD = origin/main = fab1218`; árvore limpa.

---

## 2. Commits e deploys de 27/11 (todos pushed)

| Commit | Assunto | Deploy |
|---|---|---|
| `c6e2fe3` | árvore de parcelas | `dpl_96YurBhHU6AErsCE5Jw8Y6KavLsG` |
| `05f7dad` | `permissions` como catálogo global | `dpl_A8MNTHZwwa7skQWB8gMEKXNWGYoP` |
| `6883407` | estorno com colapso (front + planos/SQLs) | `dpl_516TMnzqkBWVkHkD9ShM4kkFtLaj` |
| `bac0d28` | KPI + constraint `Reabsorvida` | `dpl_BJ9XhWb4owVjD1V1hYHTNqt245EF` |
| `e1ca251` | KPI por valor do contrato + scripts globais | `dpl_BpaSyPGzoWND18qBRxHUq5bSvX8P` |
| `b897439` | coluna A Receber da listagem calculada | `dpl_5XeyWTA2XUYKHwTcjaFkn2Z3xdQb` |
| `6090ef3` | modais responsivos no mobile | `dpl_4GfUL34qa2yc7enYEztim73XrTEF` |
| `199c435` | status de parcelas no feminino | `dpl_DeETqEBQ1RCMYasrmZLd33XWKedL` |
| `d322f17` | regra unificada do colapso | `dpl_ECu7JVninbq9qghXjTwBgPC48499` |
| `bb14550` | performance do modal de estorno | `dpl_dsGuJPCZs7BsgForDn7yDKbt7duk` |
| `f9e95ed` | performance do modal de recebimento | `dpl_F1xX1jSZ7ZQGUHkn7hhuPJjA7Cdb` |
| `fab1218` | remove `contractNumber` inexistente + versiona SQLs/handoffs | Vercel `success` |

---

## 3. O que você aplicou no banco (SQL Editor)

| Aplicação | Resultado colado |
|---|---|
| `FORWARD-ARVORE-PARCELAS` | `colunas=2`, `vinculadas=0`, `backup=1` |
| `VERIFY-ARVORE-PARCELAS` | todas `OK`, `resumo=PASS` |
| `FORWARD-ESTORNO-COLAPSO` | RPC v1 criada, `OK` |
| `FORWARD-CHECK-REABSORVIDA-20261127` | `aceita_reabsorvida=1`; depois `3` linhas reabsorvidas |
| `VERIFY-RECEIVABLE` (antes) | contrato 138: `gravado=14000`, `esperado=12500` |
| `FORWARD-RECEIVABLE` (gatilho v5) | `gatilho_v5=1`, `backup=1` |
| `FORWARD-DADOS-RECEIVABLE` | `contratos_ajustados=15`, `divergentes_apos=0` |
| `FORWARD-REGRA-A-ESTORNO-COLAPSO` | `regra_a_ativa=1`, `backup=1` |
| `VERIFY-REGRA-A` | `regra_a_ativa=1`, `backup_v1=1`, `reabsorvidas=4`, **OK** |

Gatilho v5: `amountReceivable = GREATEST(contractValue − SUM(amountPaid), 0)`.
Backup dos valores anteriores em `public.backup_dados_receivable_20261127`.

---

## 4. KPI `A Receber` — causa e correção final

O gatilho antigo somava `amount − amountPaid` das parcelas em aberto. Em cadeias
legadas sem vínculo, a original estornada reabre 3.000 enquanto a residual
quitada de 1.500 permanece — dívida duplicada (14.000 em vez de 12.500).

Correções:

- front: `A Receber` (KPI, tabela, mobile, CSV e ordenação) =
  `valor do contrato − recebido`;
- banco: gatilho v5 + 15 contratos ajustados.

**Estado final conferido na tela (contrato 138):**

- Recebido: **4.500,00** (3.000 da parcela 5 + 1.500 da residual 6);
- A receber: **10.500,00** (15.000 − 4.500);
- Total de parcelas: **6** (a reabsorvida fica oculta).

---

## 5. Estorno × desfazer desdobramento — concluído

| Situação | Operação | Resultado |
|---|---|---|
| folha com `Pago > 0` (ex.: 2.1.1.1 recebeu 500) | **Estornar** | devolve o dinheiro; folha vira devedora |
| mãe com filha e nenhum pago na subárvore | **Desfazer desdobramento** | estorna o pago da mãe; filha vira `Reabsorvida` e some; mãe volta ao valor cheio |

A **regra B** (exigir folha `Estornado`) foi substituída pela **regra A
unificada**: basta que **nenhum descendente ativo tenha `Pago > 0`**. Folha
`Aberto` ou `Estornado`, ambas com `Pago = 0`, são elegíveis. A regra B era um
subconjunto da A.

Teste final executado por você:

- pagou e estornou a `2.1`;
- clicou em **Desfazer desdobramento** na `2`;
- a `2.1` desapareceu (4ª linha `Reabsorvida`);
- a `2` voltou a `Pago = 0` / `A Receber = 3.000`, status **Estornada**.

Arquivos: `FORWARD/VERIFY/ROLLBACK-REGRA-A-ESTORNO-COLAPSO-20261127.sql`.

---

## 6. Ajustes de UI

- **Responsividade:** `Modal.tsx` agora limita a largura no mobile; `max-w-*`
  do chamador só vale a partir de `sm`. Corrigiu modal de Usuários e de Novo
  Lançamento Financeiro (Data e Valor empilhados no iPhone).
- **Feminino:** `formatInstallmentStatus` em `lib/utils.ts` mostra Aberta,
  Parcial, Quitada, Cancelada, Prorrogada, Atrasada, Estornada, Reabsorvida.
  Valores gravados no banco continuam os canônicos.
- **Performance:** `ReverseInstallmentModal` e `ReceiveInstallmentModal`
  mantêm estado local (memoizados). Digitar não re-renderiza a página de
  contratos/parcelas. O pré-preenchimento do recebimento em lote foi preservado
  via `lastPayment`.

---

## 7. Reteste do console — 400 em `contracts`

O reteste encontrou `GET .../rest/v1/contracts?select=...contractNumber...`
com status `400`, porque `contracts` não tem a coluna `contractNumber`
(o schema usa `processNumber`). O badge `ContractNumberBadge` já fazia fallback
para `#id`.

Correção aplicada e publicada em `app/contas-a-receber/page.tsx`: `select`
reduzido a `id, isProBono, isFinanced, installmentsCount`.

Resultado final medido no navegador:

| Ambiente | `environment` | `organizacao_no_token` | `contracts` | `/api/auth/session` |
|---|---|---|---|---|
| produção | production | production | 200 | 200 |
| teste | test | test | 200 | 200 |

Mensagens `[Violation] Forced reflow`, `requestAnimationFrame`, aviso de chart
e `A listener indicated an asynchronous response...` (mensageria de extensão do
Chrome) são ruído: não há `chrome.runtime.onMessage`/`sendResponse` no repo.

---

## 8. Pendências

1. **Teste 2** — configurações/backup/OAuth (não iniciado).
2. Rodar o cenário negativo do colapso: folha com `Pago > 0` deve bloquear.
3. Nenhuma pendência funcional na árvore, no KPI, nos modais ou no console.

---

## 9. Arquivos importantes

- `docs/PLANO-ARVORE-PARCELAS-20261126.md`
- `docs/PLANO-ESTORNO-COLAPSO-ARVORE-20261126.md` (+ adendo da regra unificada)
- `docs/PLANO-CORRECAO-RECEIVABLE-CONTRATO-20261127.md`
- `docs/FORWARD-CHECK-REABSORVIDA-20261127.sql`
- `docs/FORWARD-RECEIVABLE-CONTRATO-20261127.sql`
- `docs/FORWARD-DADOS-RECEIVABLE-20261127.sql`
- `docs/VERIFY-RECEIVABLE-CONTRATO-20261127.sql`
- `docs/FORWARD/VERIFY/ROLLBACK-REGRA-A-ESTORNO-COLAPSO-20261127.sql`
- `components/contas-a-receber/ReverseInstallmentModal.tsx`
- `components/contas-a-receber/ReceiveInstallmentModal.tsx`
- `components/cashflow/NewTransactionModal.tsx`
- `components/Modal.tsx`
- `lib/utils.ts`

---

## 10. Restrições lembradas

- Nenhum SQL executado pelo agente; você roda no SQL Editor e cola o resultado.
- Nenhum `UPDATE`/`DELETE` em dados de negócio sem autorização explícita e medição prévia.
- Nenhuma credencial/chave no chat.
- Sem dumps ou linhas completas de prévia.
- Não atualizar Supabase CLI de `2.75.0` para `v3.4.0`.
- Não comitar/publicar sem pedido explícito.
- Toda rotina declara/filtra/traz `environment`.

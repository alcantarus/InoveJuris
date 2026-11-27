# Handoff — noite de 27/11/2026 (retomada amanhã)

> **Regra permanente:** existe **um único banco**; `production` e `test` são
> valores de `environment`, não databases separados
> (`docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`).
> Nenhum SQL foi executado pelo agente — você rodou tudo no SQL Editor e colou
> os resultados. Nada foi comitado depois do último deploy; este documento está
> salvo no disco.

---

## 1. Estado geral

- **Teste 1 = OK**: claim ✅, `dados_isolados` ✅, `erro_console` ✅,
  `permissions` ✅ (catálogo global).
- **Teste 2 (configurações/backup/OAuth)** — ainda não iniciado.
- **Árvore de parcelas** aplicada apenas com parcelas novas (sem backfill).
- **KPI `A Receber`** corrigido no front e no banco; 15 contratos ajustados.
- **Estorno com colapso** implementado, mas **não foi concluído com sucesso**:
  esbarrou na constraint de status e, depois disso, na regra B (detalhe §5).

Último deploy: `dpl_5XeyWTA2XUYKHwTcjaFkn2Z3xdQb` — **Ready**, alias
`https://inove-juris.vercel.app`.

---

## 2. Commits e deploys de hoje (tudo já pushed)

| Commit | Assunto | Deploy |
|---|---|---|
| `c6e2fe3` | árvore de parcelas | `dpl_96YurBhHU6AErsCE5Jw8Y6KavLsG` |
| `05f7dad` | `permissions` como catálogo global | `dpl_A8MNTHZwwa7skQWB8gMEKXNWGYoP` |
| `6883407` | estorno com colapso (front + planos/SQLs) | `dpl_516TMnzqkBWVkHkD9ShM4kkFtLaj` |
| `bac0d28` | KPI + constraint `Reabsorvida` | `dpl_BJ9XhWb4owVjD1V1hYHTNqt245EF` |
| `e1ca251` | KPI por valor do contrato + scripts globais | `dpl_BpaSyPGzoWND18qBRxHUq5bSvX8P` |
| `b897439` | coluna A Receber da listagem calculada | `dpl_5XeyWTA2XUYKHwTcjaFkn2Z3xdQb` |

`HEAD = b897439`, `main` alinhado com `origin/main`.

---

## 3. O que você aplicou no banco (SQL Editor)

| Aplicação | Resultado colado |
|---|---|
| `FORWARD-ARVORE-PARCELAS` | `colunas=2`, `vinculadas=0`, `backup=1` |
| `VERIFY-ARVORE-PARCELAS` | todas `OK`, `resumo=PASS` |
| `FORWARD-ESTORNO-COLAPSO` | `VERIFY`: RPC v1 criada, árvore presente, `OK` |
| `FORWARD-CHECK-REABSORVIDA-20261127.sql` | `aceita_reabsorvida = 1`; `linhas_reabsorvidas = 3` (colapso já executado em 3 subparcelas) |
| `VERIFY-RECEIVABLE-CONTRATO` (antes) | contrato 138: `gravado=14000`, `esperado=12500` |
| `FORWARD-RECEIVABLE-CONTRATO` (gatilho v5) | `gatilho_v5=1`, `backup=1` |
| `FORWARD-DADOS-RECEIVABLE` | `contratos_ajustados=15`, `divergentes_apos=0` |

Gatilho v5: `amountReceivable = GREATEST(contractValue − SUM(amountPaid), 0)`.
Os 15 contratos divergentes tiveram o valor corrigido, com backup em
`public.backup_dados_receivable_20261127`.

---

## 4. KPI `A Receber` — causa e correção

O gatilho antigo somava `amount − amountPaid` das parcelas em aberto. Em cadeias
legadas sem vínculo, a original estornada reabre 3.000 enquanto a residual
quitada de 1.500 permanece — a dívida fica duplicada (14.000 em vez de 12.500).

Correções:

- front: `A Receber` (KPI, tabela, mobile, CSV e ordenação) = `valor do contrato − recebido`;
- banco: gatilho v5 + 15 contratos ajustados.

Contrato 138: 15.000 − 2.500 = **12.500**.

---

## 5. Estorno x desfazer desdobramento — ponto sensível (não resolvido)

Você estornou a parcela **1** (legada) e a folha **2.1.1.1** com sucesso. A tentativa
de colapsar uma mãe falhou com:

```
23514: new row for relation "installments" violates check constraint
"check_installment_status"
```

Motivo: o status `Reabsorvida` não era aceito. O `FORWARD-CHECK-REABSORVIDA`
foi rodado e confirmado: `aceita_reabsorvida = 1`. Já existem **3 linhas
`Reabsorvida`** no banco, ou seja, o colapso funcionou nessas subparcelas e elas
foram ocultadas da tela. O que ficou pendente é o desdobramento da `2`, cuja
folha `2.1` está `Aberto` com `Pago = 0` (impasse da regra B, abaixo).

Depois disso apareceu o impasse atual, explicado na conversa:

| Situação | Operação correta |
|---|---|
| folha com `Pago > 0` (ex.: 2.1.1.1 recebeu 500) | **Estorno** — devolve o dinheiro |
| mãe com filha sem `Pago` (ex.: `2` pagou 1.000 e gerou `2.1` Aberto de 2.000) | **Desfazer desdobramento** — devolve os 1.000, a `2.1` some, a `2` volta a 3.000 |

A `2.1` está `Aberto` com `Pago = 0`: é só a dívida restante. Não há dinheiro
nela para estornar — o que existe é o **desdobramento da 2** a ser desfeito.

### Decisão pendente

A regra implementada hoje é a **B** (folha precisa estar `Estornado`). Ela torna
o caso da `2` impossível: a folha `2.1` está `Aberto`, não pode ser estornada
(sem pago) e a mãe fica presa.

**Proposta (não implementada): regra A** — permitir colapsar quando
**nenhum descendente ativo tiver `Pago > 0`**, aceitando folhas `Aberto` ou
`Estornado`. A RPC já faz o resto: estorna o pago da mãe, marca a filha como
`Reabsorvida` e devolve o valor cheio.

Também proposto: renomear o botão das parcelas com filha para
**“Desfazer desdobramento”**, mantendo “Estornar” só nas folhas com pago.

> Não implementei nada disso ainda. Você foi dormir antes de decidir.

---

## 6. Ordem sugerida para amanhã

1. ~~Confirmar o `FORWARD-CHECK-REABSORVIDA`~~ — **feito**: `aceita_reabsorvida = 1`, 3 linhas reabsorvidas.
2. Rodar `VERIFY-RECEIVABLE-CONTRATO` final (contrato 138 `gravado = 12500`).
3. ~~Decidir a **regra A**~~ — **aprovada e implementada em 27/11**: front e RPC
   agora usam a regra unificada (nenhum descendente com `Pago > 0`). Arquivos
   `FORWARD/VERIFY/ROLLBACK-REGRA-A-ESTORNO-COLAPSO-20261127.sql` preparados.
   Falta você rodar o `FORWARD` e o `VERIFY` no SQL Editor e testar a `2`.
4. Testar o colapso da `2` (deve voltar a 3.000) e o bloqueio quando houver pago.
5. Iniciar **Teste 2** (configurações/backup/OAuth).
6. Registrar tudo no handoff e comitar/publicar com pedido explícito.

---

## 7. Arquivos importantes

- `docs/PLANO-ARVORE-PARCELAS-20261126.md`
- `docs/PLANO-ESTORNO-COLAPSO-ARVORE-20261126.md` (+ adendo da regra B/A)
- `docs/PLANO-CORRECAO-RECEIVABLE-CONTRATO-20261127.md`
- `docs/FORWARD-CHECK-REABSORVIDA-20261127.sql`
- `docs/FORWARD-RECEIVABLE-CONTRATO-20261127.sql`
- `docs/FORWARD-DADOS-RECEIVABLE-20261127.sql`
- `docs/VERIFY-RECEIVABLE-CONTRATO-20261127.sql`
- `docs/ROLLBACK-TRIGGER-RECEIVABLE-20261127.sql`
- `docs/ROLLBACK-DADOS-RECEIVABLE-20261127.sql`
- `docs/HANDOFF-TENANT-20261126.md` (§6.5, §6.6)

---

## 8. Restrições lembradas

- Nenhum SQL executado pelo agente; você roda no SQL Editor e cola o resultado.
- Nenhum `UPDATE`/`DELETE` em dados de negócio sem autorização explícita e medição prévia.
- Nenhuma credencial/chave no chat.
- Sem dumps ou linhas completas de prévia.
- Não atualizar Supabase CLI de `2.75.0` para `v3.4.0`.
- Não comitar/publicar sem pedido explícito.
- Toda rotina declara/filtra/traz `environment`.
- Boa noite — retomar amanhã com calma.

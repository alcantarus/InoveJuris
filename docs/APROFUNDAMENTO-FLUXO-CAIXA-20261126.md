# Aprofundamento do Fluxo de Caixa — resultado da execução (26/11/2026)

> **Regra permanente:** um único banco (PostgreSQL 17.6). `production` e `test`
> são valores da coluna `environment`, não bancos separados. Toda seção declara
> ou devolve o ambiente. Ver `docs/CONVENCAO-AMBIENTES-BANCO-UNICO.md`.

## Execução

- Script: `docs/APROFUNDAMENTO-FLUXO-CAIXA-20261126.sql`, uma única célula
  (`aprofundamento_fluxo_caixa_20261126`), somente leitura, terminada em
  `rollback`.
- Coletado em **2026-11-26T13:30:53.931075+00:00**, PostgreSQL **17.6**.
- Ambientes: `production` e `test`. Nenhum `UPDATE`/`DELETE` executado.
- Continuação do diagnóstico executado às 13:25:28 UTC, cujo resultado está em
  `docs/DIAGNOSTICO-FLUXO-CAIXA-20261126.md`.

## Decisão do usuário

Continuar com o aprofundamento; a fonte de verdade do saldo será decidida
**depois** deste rastreio. Nenhuma correção foi autorizada até aqui.

## Resumo conferido

| Medição | Esperado | Obtido |
|---|---:|---:|
| Contas divergentes | 5 | 5 |
| Lançamentos sem conta | 9 | 9 |
| Grupos duplicados / linhas | 6 / 17 | 6 / 17 |
| Pagamentos com conta de outro ambiente | 3 | 3 |
| Parcelas com `amountPaid` divergente | 1 | 1, **mas é falso positivo** |
| Parcelas da view de previsão afetadas | — | 3 |

## 1. Saldo divergente — rastreio

| Conta | Delta | Logs da conta | Logs de transações | Leitura |
|---|---:|---:|---:|---|
| Caixa Econômica Federal (2) | -4.600,00 | 0 | 0 | Sem rastro recente |
| Inter (3) | -10.070,00 | 8 | 8 | Todas as mudanças pareadas com INSERTs de mesmo valor |
| Cofre (5) | -3.000,00 | 0 | 0 | Sem rastro recente |
| Banco do Brasil (6) | -101,90 | 0 | 0 | Sem rastro recente |
| Mercantil (16) | +6.500,00 | 12 | 9 | Saga do estorno de 25/11, toda com `performed_by=null` |

### Inter

Os 8 `UPDATE` em `bank_accounts` e os 8 `INSERT` em `financial_transactions`
ocorrem no **mesmo segundo**, com valores que se compensam exatamente:

| Data/hora UTC | Saldo anterior → novo | Lançamento |
|---|---|---|
| 23/11 21:00:07 | 907,77 → 1.357,77 | +450,00 |
| 24/11 01:28:23 | 1.357,77 → 1.259,77 | -98,00 |
| 24/11 10:30:13 | 1.259,77 → 1.232,77 | -27,00 |
| 24/11 10:30:33 | 1.232,77 → 1.211,67 | -21,10 |
| 24/11 15:50:13 | 1.211,67 → 911,67 | -300,00 |
| 25/11 00:47:35 | 911,67 → 611,67 | -300,00 |
| 25/11 01:32:27 | 611,67 → 557,04 | -54,63 |
| 25/11 11:04:38 | 557,04 → 546,45 | -10,59 |

São efeitos do trigger `trigger_update_balance`, não sobrescritas manuais.
A divergência de R$ 10.070,00 é **anterior** a essa janela.

### Mercantil

Sequência em 25/11 (`performed_by=null` em todas):

- 07:37:25 — 0,00 → 1.621,00 → 0,00 → 1.621,00
- 07:38:09 — 1.621,00 → 0,00
- 07:48:06 — 0,00 → 811,00 → 0,00 → 811,00
- 07:52:53 — 811,00 → 2.311,00 → 811,00 → 2.311,00
- 18:18:22 — 2.311,00 → 2.116,48 (-194,52)
- 18:35:51 — 2.116,48 → 2.016,42 (-100,06)

Os ciclos acompanham INSERT/UPDATE/DELETE de lançamentos ligados à parcela 207
("Recebimentos 01/02 Jessica São Paulo", estorno de 1.621,00 e novo pagamento
de 811,00). Também são efeitos do trigger, não edição manual isolada.

### Conclusão sobre a causa

**Não há evidência de sobrescrita manual recente de saldo.** As mudanças
auditadas são coerentes com o trigger. As divergências são anteriores à janela
de auditoria (ou sem registro nela), sobretudo nas três contas sem logs.

Isso **não resolve** qual valor está correto. O histórico contém lançamentos
explicitamente descritos como "(sem impacto de saldo)" e "Ajuste de conciliação
histórica", então `saldo_calculado` é apenas o que o histórico produziria se
todo lançamento fosse uma movimentação bancária real — não é prova de que
`current_balance` esteja errado. A decisão depende de confronto com extrato
bancário ou confirmação de negócio, conta a conta.

## 2. Lançamentos sem conta — refutado como defeito

Os 9 registros têm descrição explícita e foram criados em datas conhecidas:

| Ambiente | IDs | Descrição | Data de criação |
|---|---|---|---|
| `production` | 1241, 1242 | "Registro Parcela 1 … Conta 2 Caixa Economica Federal **(sem impacto de saldo)**" | 21/11 15:57:35 |
| `production` | 1243, 1244 | "Registro Parcela … **(sem impacto de saldo)**" | 21/11 16:02:16 |
| `test` | 1254, 1255, 1256 | "Ajuste de conciliação histórica - parcela 97/150/151" | 22/11 00:10:42 |
| `test` | 1251, 1252 | "Recebimento em lote - parcela 232/233 (Outros)" | 21/11 23:42 |

São **registros históricos intencionais**, feitos sem `account_id` justamente
para não alterar saldo. Não devem ser tratados como lançamentos órfãos a
corrigir. O que resta é um risco de classificação: entram em entradas/saídas
totais, mas em nenhuma conta.

## 3. Duplicados — confirmados, restritos a `test`

Os 6 grupos (17 linhas) têm o mesmo padrão: `environment=test`,
`date=2026-04-11`, `type=income`, `description=''`, contas 1 e 14, criados entre
04:16 e 05:37 UTC daquele dia.

| IDs | Valor | Linhas | Conta |
|---|---:|---:|---:|
| 244, 245 | 166,66 | 2 | 1 |
| 215, 216 | 200,00 | 2 | 14 |
| 212, 213 | 250,00 | 2 | 14 |
| 247, 248, 249 | 500,00 | 3 | 1 |
| 224, 225, 229, 238, 242, 243 | 1.000,00 | 6 | 14 |
| 240, 241 | 3.000,00 | 2 | 14 |

Coincidem com a janela dos estornos antigos de abril/2026 já catalogados em
`docs/RASTREIO-ESTORNOS-RESULTADO-20261125.md`. Não há duplicatas em
`production`. Antes de qualquer exclusão seria preciso confirmar se cada par
corresponde a parcelas distintas — o que parece provável, dado o histórico de
reversões daquele período.

## 4. Pagamentos com conta de outro ambiente — confirmado

Os 3 registros são **reversões antigas de abril**, já identificadas no rastreio
de estornos de 25/11:

| Pagamento | Parcela | Valor | Conta | `environment` do pagamento | `environment` da conta |
|---|---|---:|---|---|---|
| `b02ef217…` | 147 | 2.000,00 | Picpay (14) | `production` | `test` |
| `ba58e2cc…` | 148 | 300,00 | Picpay (14) | `production` | `test` |
| `fbf7f49b…` | 147 | 1.600,00 | Banco do Brasil (9) | `production` | `test` |

Todas têm `financial_transaction_id=null` e `performed_by` ausente no vínculo,
logo não afetam saldo via caixa. O efeito é de **classificação**: R$ 3.900,00
em reversões estão contabilizados como `production` embora apontem para contas
de `test`. Isso ajuda a explicar por que `production` aparece com 4 reversões e
`test` com 6.

## 5. Parcela 207 — falso positivo corrigido

A parcela 207 (`production`, contrato 120) tem:

- `amount` 1.621,00, `amountPaid` 811,00, status `Quitado`;
- pagamento de 1.621,00 sem transação;
- pagamento de 811,00 com transação 1281;
- estorno de 1.621,00.

O diagnóstico comparou `amountPaid` com a **soma dos pagamentos**
(1.621 + 811 = 2.432) e acusou divergência de -1.621. Mas
**2.432 - 1.621 (estorno) = 811**, exatamente o `amountPaid`. A parcela está
correta.

Corrigi a métrica nos dois scripts: a comparação agora usa
`pagamentos - reversões`. O caso já estava fechado na decisão do item 1/KPI de
novembro e não deve ser reaberto.

## 6. View de previsão — novos achados

| Ambiente | Linhas | Previsto na view | Observações |
|---|---:|---:|---|
| `production` | 8 | 31.922,64 | 1 Parcial, 5 Prorrogada, 2 Quitado |
| `test` | 3 | 12.350,00 | 1 Cancelada, 1 Estornado, 1 Quitado |

Três linhas afetadas:

1. **Parcela 140 (`production`, Parcial, vence 30/11):** valor 3.000,00, pago
   2.000,00, restante 1.000,00. A view prevê 2.700,00 (90% do valor cheio),
   superestimando em **1.700,00**.
2. **Parcela 227 (`test`, Estornado, vence 21/12):** 10.000,00 → previsto
   9.000,00. **Correto** conforme o item 3.2: `Estornado` volta a ser título a
   receber e o rótulo é preservado. Não mexer.
3. **Parcela 238 (`test`, Cancelada, contrato `Cancelado`, vence 21/12):**
   previsto 1.350,00. **Indevido**: contrato cancelado não deve entrar na
   previsão; a RPC de projeção já exclui cancelados.

Além disso, as parcelas `Quitado` entram na view com 100% do valor
(12.726,00 em `production` e 2.000,00 em `test`) embora já estejam pagas. A RPC
de projeção aponta 23.820,60 em `production` e 1.000,00 em `test` somando todos
os meses futuros, e 10.726,00 no mês atual em `production`. View e RPC usam
janelas e regras diferentes — não são números diretamente comparáveis.

## Classificação revisada

| Achado do diagnóstico | Classificação após aprofundamento |
|---|---|
| Saldo divergente em 5 contas | **Confirmado**, causa histórica; fonte de verdade ainda pendente de decisão |
| RPC `update_account_balance` inexistente + UPDATE manual | **Confirmado**; continua sendo risco de código |
| KPIs limitados a 100 linhas | **Confirmado** |
| Previstas zeradas por `installments.type` | **Confirmado** |
| Policies `USING (true)` | **Refutado** |
| 9 lançamentos sem conta | **Refutado como defeito** — registros intencionais |
| 6 grupos duplicados | **Confirmado**, só em `test`, origem em abril/2026 |
| 3 pagamentos de ambiente divergente | **Confirmado**, reversões antigas; R$ 3.900,00 classificados como `production` |
| 1 parcela com `amountPaid` divergente | **Refutado** — falso positivo da métrica, corrigida |
| View de previsão | **Novo achado**: cancelada incluída, parcial superestimada, quitadas contadas |

## Próximo passo

Só com autorização explícita. As decisões pendentes são:

1. **Saldo:** manter `current_balance` e reconciliar conta a conta com extrato,
   ou adotar o saldo recalculado como fonte de verdade;
2. **Código:** remover a chamada RPC inexistente e o `UPDATE` manual de
   `movimentacoes/page.tsx`, deixando o trigger como única escrita de saldo;
3. **View de previsão:** excluir canceladas e usar saldo em parciais;
4. **3 reversões de abril:** manter como histórico ou reclassificar para `test`;
5. **Duplicatas de `test`:** manter como histórico ou investigar parcela a
   parcela antes de qualquer exclusão.

Qualquer mudança de estrutura passa por medição prévia, `forward`/`verify`/
`rollback`; qualquer mudança de dados de negócio só com autorização explícita.
Nada foi alterado até aqui.

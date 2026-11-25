# Diagnóstico de Contas a Receber — resultado confirmado (25/11/2026)

> **Atenção: este arquivo é Markdown, não SQL.** Não cole este conteúdo no SQL
> Editor — o `#` do título causa `ERROR: 42601: syntax error at or near "#"`.
> O script executável é `docs/DIAGNOSTICO-CONTAS-A-RECEBER-20261125.sql`
> (célula `diagnostico_contas_a_receber`), que já foi rodado e interpretado.

Fonte: célula `diagnostico_contas_a_receber` de
`docs/DIAGNOSTICO-CONTAS-A-RECEBER-20261125.sql`, executada em produção pelo
usuário às `2026-11-25T18:31:15.460836+00:00` (PG 17.6). O script é somente
leitura e termina em `rollback`. **Nenhuma alteração foi feita**; nenhum
`INSERT`/`UPDATE`/`DELETE` foi executado.

Este documento interpreta a célula, separando **fato confirmado**, **candidato a
divergência** e **hipótese refutada**. Segue o padrão de
`docs/DIAGNOSTICO-CONTRATOS-RESULTADO-20261124.md`.

---

## 1. Resumo executivo

| Pergunta da checagem | Resposta com base nos dados |
|---|---|
| O KPI “Recebido este Mês” reproduz a regra do app? | **Sim, aritmeticamente.** Bruto R$ 36.032,44 − R$ 2.621,00 (reversões) − R$ 1.621,00 (pagamentos estornados com vínculo) = **R$ 31.790,44**. Há uma decisão de regra em aberto: uma reversão de R$ 1.000,00 em novembro não tem vínculo e seu recebimento original é de outro mês. |
| A “Previsão (30d)” inclui contrato cancelado ou parcela sem saldo? | **Não.** 7 parcelas, R$ 21.923,20, zero sem saldo e zero de contrato cancelado. |
| `amountPaid` bate com pagamentos − reversões? | **Não em 8 parcelas.** As 8 diferenças somam **R$ 14.800,00**, exatamente a soma das 9 reversões sem vínculo. É uma única família de causa, não oito problemas distintos. |
| Existem pagamentos órfãos sem parcela? | **Não.** Zero. |
| A `contract_receivables_summary` bate com as parcelas? | `amount_to_receive`: **0 divergências**. `amount_received`: **8 divergências** (as mesmas 8 parcelas acima). `overdue_amount`: **6 divergências**, com causa diferente (definição de “vencido”). |
| Há estorno apontando para pagamento inexistente, duplo estorno do mesmo original ou estorno em parcela diferente? | **Não.** Zero em todos os três controles. |
| Há parcela duplicada, cancelada/estornado com dinheiro, aberto já integralmente pago ou `Parcial` inconsistente? | **Não.** Zero em todos os controles. |

**Conclusão central:** os números divergent não vieram de pagamentos perdidos ou
de duplicidade. Vieram de **reversões registradas em `payments` que não
atualizaram `amountPaid`/`amountReceived`**, quase todas sem o vínculo
`reverses_payment_id`. Nenhuma correção foi aplicada.

---

## 2. Confirmações estruturais

| Item | Resultado | Interpretação |
|---|---|---|
| `payments.id` | **uuid** | Confirma a divergência com o baseline do repositório (BIGINT), já vista em 24/11 |
| `payments.payment_date` | **timestamptz** | Confirma divergência com o baseline (DATE) |
| `contracts.id`, `installments.id`, `bank_accounts.id` | bigint | Consistente |
| FK `payments.installment_id → installments.id` | `ON DELETE CASCADE` | Pagamento não fica órfão se a parcela for apagada |
| FK `payments.reverses_payment_id → payments.id` | self-FK, `ON DELETE SET NULL` | Vínculo de estorno existe no schema; 9 linhas não o usam |
| FK `payments.financial_transaction_id` | `ON DELETE SET NULL` | Compatível com `process_installment_estorno`, que apaga a transação antiga |
| FK `payments.account_id` / `category_id` | `NO ACTION` | Conta/categoria não podem ser removidas enquanto houver pagamento |
| CHECK de `contracts.status` | aceita `Aberto, Parcial, Quitado, Cancelado, Estornado, Prorrogado` | Correto |
| CHECK de `installments.status` | aceita `Aberto, Parcial, Quitado, Cancelado, Cancelada, Prorrogada, Atrasada, Estornado` | Correto |
| CHECK de `payments.payment_method` | lista de 8 formas, ou nulo | Correto |
| Índice `uq_installments_contract_number` | **presente** | P1 de 24/11 está aplicado |
| Índices `idx_payments_installment_id`, `idx_payments_environment`, `idx_payments_type_payment_date` | **presentes** | P1 de 24/11 está aplicado |
| `installments` sem `updated_at` | confirmado | Não há auditoria de alteração de parcela na tabela |
| RPCs do módulo | `process_installment_estorno`, `rpc_receber_parcela_com_metodo` (10 args), `process_installment_payment` (5 e 9 args), `process_contract_cancellation` | `anon=false`, `authenticated=true`, `service_role=true` em todos |
| View `contract_receivables_summary` | existe, 12 colunas, sem policies e **sem `security_invoker`** | Ver item 5.5 |

A distribuição de `payments` é **162 pagamentos com conta**, **9 pagamentos sem
conta** e **10 reversões com conta** (181 linhas). Os 9 sem conta são os mesmos
pagamentos sem conta recuperável fechados em 24/11; não são órfãos de parcela.

---

## 3. Achado principal — reversões não refletidas no salvo da parcela

### 3.1 A relação matemática

`parcela_vs_pagamentos` encontrou **8 parcelas** nas quais
`amountPaid ≠ (soma de payments − soma de reversões)`:

| Parcela | Contrato | Status da parcela | `amountPaid` | Pagamentos | Reversões | Líquido | Divergência |
|---:|---:|---|---:|---:|---:|---:|---:|
| 129 | 81 | Quitado | 4.000,00 | 4.000,00 | 4.000,00 | 0,00 | **4.000,00** |
| 147 | 90 | Quitado | 600,00 | 600,00 | 3.600,00 | −3.000,00 | **3.600,00** |
| 87 | 65 | Parcial | 500,00 | 500,00 | 2.500,00 | −2.000,00 | **2.500,00** |
| 113 | 74 | Estornado | 0,00 | 0,00 | 2.000,00 | −2.000,00 | **2.000,00** |
| 122 | 76 | Estornado | 0,00 | 0,00 | 1.000,00 | −1.000,00 | **1.000,00** |
| 227 | 134 | Estornado | 0,00 | 0,00 | 1.000,00 | −1.000,00 | **1.000,00** |
| 103 | 70 | Quitado | 500,00 | 500,00 | 400,00 | 100,00 | **400,00** |
| 148 | 91 | Quitado | 300,00 | 300,00 | 300,00 | 0,00 | **300,00** |

**Soma das divergências: R$ 14.800,00.**

As 9 reversões sem vínculo listadas em `estornos.sem_vinculo_com_original` são
exatamente: 1.000 (parcela 227), 2.000 (147), 2.000 (113), 300 (148), 1.600
(147), 4.000 (129), 1.000 (122), 2.500 (87) e 400 (103) — **soma R$ 14.800,00**,
com as mesmas parcelas. A coincidência é exata, por parcela e por valor. Portanto
a divergência é causada por essas reversões, não por pagamento ausente.

`view_vs_parcelas.total_recebido_divergente` lista os **mesmos 8 contratos**
(81, 90, 65, 74, 76, 134, 70, 91): o campo denormalizado
`contracts.amountReceived` exibido pela view também não foi recalculado após as
reversões. É o mesmo problema vista da tela de contratos.

### 3.2 Duas situações distintas dentro da mesma família

1. **Reversão com `amountPaid` obsoleto (5 parcelas):** 129, 147, 87, 103 e 148.
   O pagamento original existe, a reversão existe, mas a parcela continua
   `Quitado`/`Parcial` com o valor antigo. Em 147 e 87 a reversão é **maior que o
   pagamento** (3.600 contra 600; 2.500 contra 500), deixando líquido negativo.
   São os casos mais graves: o saldo da parcela e o KPI não representam o que o
   histórico de caixa diz.
2. **Parcela já `Estornado` com `amountPaid = 0` (3 parcelas):** 113, 122 e 227.
   Aqui o status da parcela está correto; não há pagamento original registrado e
   a reversão funciona como registro de saída. O comparador do diagnóstico marca
   divergência porque compara `0` com um líquido negativo, mas **não há erro de
   status**. A questão é se esse histórico deve ou não entrar no KPI do mês.

### 3.3 Por que a função atual não explica os 9 casos

`process_installment_estorno` (v7, 2026-11-21) grava `reverses_payment_id` quando
encontra o pagamento original, zera `amountPaid`, `interest` e `fine`, muda o
status para `Estornado` e apaga a transação vinculada. Nenhuma das 9 reversões
sem vínculo segue esse caminho completo: ou o vínculo está nulo, ou o salvo da
parcela não foi baixado. Ou seja, são registros **manuais/legados ou de versão
anterior da rotina**, não criações da rotina atual. Isto é inferência de
comportamento a partir do código e dos dados; não há auditoria em
`installments` (sem `updated_at`) para datar a alteração.

---

## 4. KPI “Recebido este Mês” — aritmética correta, regra a decidir

| Componente | Valor |
|---|---:|
| Bruto (24 linhas de novembro) | R$ 36.032,44 |
| − reversões do mês (`type='reversal'`) | R$ 2.621,00 |
| − pagamentos do mês estornados com vínculo | R$ 1.621,00 |
| − descrição contendo “estorno” | R$ 0,00 |
| **Líquido segundo a regra reproduzida** | **R$ 31.790,44** |

A conta fecha exatamente. O único ponto sensível é a reversão sem vínculo
`60fe1d1b-10ad-47c7-aab0-11a4078297d0` (21/11, parcela 227/contrato 134,
R$ 1.000,00, “Estorno: erro no sistema”): ela é subtraída de novembro, mas seu
recebimento original está fora do mês e, portanto, não é excluído de novembro.
O helper citado no handoff cobre estornos antigos sem vínculo por valor + parcela;
aqui ele remove o pagamento original, que já não estava na janela do mês. O
resultado é um mês com uma saída de caixa sem entrada correspondente na mesma
janela.

**Não é erro de soma.** É uma decisão de regra de negócio: ou o KPI deve mostrar
apenas entradas do mês menos estornos de entradas do mês, ou deve mostrar o
saldo de caixa do mês incluindo devoluções de meses anteriores. Precisa de
decisão explícita antes de qualquer mudança em `lib/payments.ts`.

---

## 5. Candidatos restantes e hipóteses refutadas

### 5.1 “Quitado” com saldo devedor — 5 parcelas (novo candidato)

| Parcela | Contrato | Valor | `amountPaid` | Falta |
|---:|---:|---:|---:|---:|
| 194 | 107 | 3.000,00 | 1.500,00 | 1.500,00 |
| 231 | 135 | 2.000,00 | 1.000,00 | 1.000,00 |
| 207 | 120 | 1.621,00 | 811,00 | 810,00 |
| 230 | 135 | 2.000,00 | 1.500,00 | 500,00 |
| 237 | 135 | 2.000,00 | 1.500,00 | 500,00 |

Total em aberto: **R$ 4.310,00**. Três das cinco são do contrato 135 — o mesmo
contrato dos pagamentos sem conta fechados em 24/11. São candidatos a status
alterado antes da quitação integral ou a valor da parcela revisado depois do
pagamento. **Não corrigir sem consultar o histórico de `payments` de cada
parcela.**

### 5.2 “Vencido” divergente — 6 contratos (diferença de definição, não de dado)

A view `contract_receivables_summary` **exclui** `prorrogada`/`prorrogado` de
`overdue_amount` e `overdue_installments`; o recálculo do diagnóstico **inclui**
`prorrogada` na lista de status vencidos (`aberto, parcial, atrasada,
prorrogada`). Por isso a view mostra R$ 0,00 onde o recálculo encontra
R$ 3.000,00 (contratos 79 e 77), R$ 2.800,00 (82), R$ 2.250,00 (8),
R$ 2.100,00 (89) e R$ 1.821,60 (2).

`a_receber_divergente` deu **zero** justamente porque ali as duas definições
coincidem (ambas excluem quitado/cancelado/estornado e mantêm prorrogada). Ou
seja, **não há dado errado**: há duas definições de “vencido” convivendo. Qual
delas é a correta é regra de negócio e precisa de decisão; não se deve “consertar”
a view com base apenas neste diagnóstico.

### 5.3 Os 26 acima do valor — reconfirmação, sem nova ação

`status_vs_valores.acima_do_valor` trouxe os mesmos 26 casos de 24/11 (parcelas
134/16, 43/35, 109/73, 120/15, etc.). Em 24/11 foi provado que
`pago == SUM(payments)` nos 26: é entrada real, não erro de `amountPaid`, e o
`CHECK (amountPaid <= amount)` foi retirado do roadmap. **Nada muda aqui.**

### 5.4 O que foi refutado nesta rodada

| Suspeita | Resultado |
|---|---|
| Previsão 30d contaminada por cancelado/sem saldo | **Falsa**: 0 e 0 |
| Pagamento órfão sem parcela | **Falso**: 0 |
| Parcela duplicada por contrato/número | **Falso**: 0 |
| Cancelada ou estornada com dinheiro recebido | **Falso**: 0 em ambos |
| Aberto/atrasada/prorrogada já integralmente pago | **Falso**: 0 |
| `Parcial` sem pagamento ou já integral | **Falso**: 0 |
| Estorno apontando para pagamento inexistente | **Falso**: 0 |
| Duplo estorno do mesmo original | **Falso**: 0 |
| Estorno em parcela diferente do original | **Falso**: 0 |
| View fora de sincronia com `contracts` | **Falsa**: 125 linhas nos dois lados, 0 contratos fora da view |
| `amount_to_receive` da view divergente | **Falsa**: 0 |

### 5.5 Ponto estrutural a parte: view sem `security_invoker`

`contract_receivables_summary` aparece com `rls_habilitado=false`, sem policies e
com `security_invoker` vazio (opções de relação nulas). As tabelas de base
estão com RLS habilitado, mas `força_rls=false`. Por semântica do PostgreSQL,
uma view sem `security_invoker` lê com os privilégios do dono, que normalmente
bypassa RLS. `authenticated` tem `SELECT` na view e `anon` não.

Isto **não prova vazamento** — não foi feito teste com JWT de outro tenant ou de
outro ambiente —, mas é um ponto de atenção de isolamento, semelhante ao que foi
tratado em Contratos em 24/11. Deve ser verificado em tarefa separada, com
medição e autorização, não misturado com os ajustes financeiros.

---

## 6. O que **não** fazer

1. Não executar `UPDATE`/`DELETE` em `payments`, `installments` ou `contracts`
   sem autorização explícita, medição prévia e rollback.
2. Não reduzir `amountPaid` dos 26 casos de 24/11 nem destes 8: onde há reversão,
   o histórico de caixa é a evidência.
3. Não inventar `reverses_payment_id` por valor + data + parcela. A própria
   rotina atual evita aproximação (“apaga exatamente a transação vinculada; nunca
   por aproximação”) e o handoff de 24/11 mostrou que heurística por valor/data é
   ambígua neste banco.
4. Não aplicar `CHECK (amountPaid <= amount)`: os 26 excessos são entrada real.
5. Não alterar a regra do KPI nem a definição de “vencido” da view sem decisão
   de negócio registrada.
6. Não usar `CREATE INDEX CONCURRENTLY` no SQL Editor (erro `25001`).

---

## 7. Próximos passos sugeridos (somente com autorização)

1. **Rastrear as 9 reversões sem vínculo**, uma a uma, com o histórico completo
   de `payments` da parcela (incluindo `financial_transaction_id` e descrição),
   para separar: (a) estorno legítimo com original fora do histórico, (b) estorno
   duplo/errado, (c) estorno aplicado à parcela certa mas com lançamento a maior.
   Casos com liquidação negativa (147 e 87) têm prioridade.
2. **Rastrear as 5 parcelas `Quitado` com saldo** (194, 231, 207, 230, 237),
   comparando `amountPaid` com cada `payment` e com a data da última alteração
   de status — lembrando que `installments` não tem `updated_at`.
3. **Decidir a regra do KPI** para reversão sem vínculo de mês anterior e a
   regra de “vencido” para `Prorrogada`. São duas decisões de produto, não bugs
   de SQL.
4. **Verificar o isolamento da view** `contract_receivables_summary` com JWT
   de `authenticated` em outro `environment`, separadamente.
5. Para qualquer mudança: medir antes, escrever forward/verify/rollback em uma
   única célula, pedir autorização explícita e aplicar somente pelo usuário no
   SQL Editor.

---

## 8. Conclusão

A checagem forense de Contas a Receber **não encontrou pagamentos perdidos,
duplicatas, órfãos ou estornos com vínculo quebrado**. Encontrou um conjunto
coerente de **R$ 14.800,00 em reversões sem vínculo** que não foram refletidas no
salvo das parcelas e no `amountReceived` dos contratos, mais **R$ 4.310,00 em
parcelas `Quitado` com saldo** ainda sem explicação no histórico e duas regras
de negócio divergentes (KPI de estorno órfão e parcela prorrogada no “vencido”).

Tudo isso são **candidatos measuráveis**, não correções. O script rodou dentro
de `begin … rollback` e não persistiu nada. Nenhum rollback de mudança anterior
foi acionado e nenhuma tabela de negócio foi escrita nesta rodada.

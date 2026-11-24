# Resultado da validação final — Contratos (24/11/2026)

Fontes (todas somente leitura; nenhuma escrita em banco):

- célula `validacao_contratos` de `docs/VALIDACAO-CONTRATOS-20261124.sql`,
  executada no SQL Editor e colada pelo usuário. `coletado_em =
  2026-11-24T17:51:38.404718+00:00`;
- célula `candidatos_conta_9` de `docs/INVESTIGACAO-EXCESSO-26-20261124.sql`,
  `coletado_em = 2026-11-24T17:58:00+00:00` (aprox.);
- célula `auditoria_contratos_completa` de
  `docs/AUDITORIA-CONTRATOS-COMPLETA-20261124.sql`, executada em uma única
  célula e colada pelo usuário. `coletado_em =
  2026-11-24T18:01:50.243675+00:00`.

## 1. O que a validação respondeu

| Bloco | Resultado | Conclusão |
|---|---:|---|
| `excesso_vs_juros_multa` | 26 candidatos, **0 explicados**, **26 não explicados** pela hipótese juros/multa | Hipótese de juros/multa **refutada**. Em toda a amostra `interest=0` e `fine=0`, logo `diferenca = excesso`. A causa real foi estabelecida na validação final (item 2.1). |
| `totais_formula_trigger` | 44 candidatos pela fórmula ingênua, **44 explicados**, **0 não explicados** | Totais denormalizados estão corretos. Os “17 totais inconsistentes” eram falsos positivos da fórmula ingênua. **Sem correção.** |
| `pagamentos_sem_conta` | 9 pagamentos; 5 com transação, **0 com conta na transação**, 4 sem transação | Não há conta recuperável na transação vinculada. **Sem preenchimento de `account_id`.** |

## 2. Leitura dos 26

O dado prova que o valor excedente **não está registrado nas colunas `interest`/`fine`**;
não prova, por si só, que `amountPaid` está errado.

Padrões visíveis na amostra (excesso = `amountPaid - amount`):

- `amount=2800,00` → `amountPaid=3000,00` em 4 parcelas (excesso 200,00)
- `amount=1821,60` → `amountPaid≈2000,00` (excesso ~178,40)
- `amount=2269,40` → `amountPaid≈2458,52` (excesso ~189,12)
- casos extremos: parcela 134/contrato 16 (excesso 1114,44) e parcela 120/contrato 15 (0,06, arredondamento)

Isso era compatível com juros/multa embutidos no valor pago, com excesso real ou
com acumulação duplicada. A validação final distinguiu as possibilidades.

### 2.1 Confirmação com `auditoria_contratos_completa` (18:01:50 UTC)

O bloco `excesso_vs_juros_multa_e_detalhe` trouxe o histórico completo dos 26:

| Métrica | Valor |
|---|---:|
| `total_candidatos` | 26 |
| `nao_explicados` | 26 (pela hipótese `interest`/`fine`) |
| `explicados_por_juros_multa` | 0 |
| `pago_igual_soma_pagamentos` | **26** |
| `pago_maior_que_soma_pagamentos` | 0 |
| `pago_menor_que_soma_pagamentos` | 0 |
| `sem_pagamentos_vinculados` | 0 |
| `com_transacao_vinculada` | 0 |

Todos os 26 estão `Quitado`, em `environment=production`, com `interest=0` e
`fine=0`, e em todos `diferenca_pago_vs_pagamentos = 0.00`. Exemplos: parcela
134/contrato 16 (`amount=2125,00`, `amountPaid=3239,44`, 1 payment de
`3239,44`); parcela 43/contrato 35 (`amount=2800,00`, `amountPaid=3000,00`,
payments de `2000,00 + 1000,00`); parcela 109/contrato 73 (`amount=9726,00`,
`amountPaid=9744,00`, 6 payments somando `9744,00`).

**Conclusão:** o valor excedente é **entrada real registrada em `payments`**,
não erro de `amountPaid` e não duplicação. A lacuna é de classificação: o
acrécimo não foi separado em `interest`/`fine`, e nenhum dos 26 pagamentos tem
`financial_transaction_id` (a evidência está no histórico `payments`, não em
`financial_transactions`). Dois pagamentos trazem descrição explícita —
`fffdfcc8-cd3f-4a64-94a7-7b2a385fd982` e
`8f81b796-cc6f-43b4-a7ab-cab51b819fff` — “(sem impacto de saldo)”.

> **Não reduzir `amountPaid`.** Fazer isso dessincronizaria `amountPaid` do
> histórico real de entradas e do caixa. Nenhum UPDATE foi preparado ou executado.

## 3. Leitura dos 9

Os 5 pagamentos com transação (ids `1251`, `1252`, `1254`, `1255`, `1256`) têm
`transaction_account_id = null`; os outros 4 não têm transação. Não existe conta
recuperável na relação `payments → financial_transactions`.

Classificação mantida: **legado intencional / dado irrecuperável por vínculo direto**.
Não inventar conta por similaridade de valor e data; isso seria inferência, não reparo.

### 3.1 Candidatos por valor+data (24/11/2026, 17:58 UTC)

A célula `candidatos_conta_9` confirmou que a busca heurística não oferece conta
segura:

- 5 dos 9 pagamentos não têm **nenhum** candidato com mesmo valor/data.
- Os 2 pagamentos de R$ 2.000,00 de 21/11 (contrato 135, transações `1251`/`1252`,
  ambas sem conta) coincidem com as **mesmas duas** transações `1257`/`1258`
  (conta 11, `environment=test`, descrições “Recebimento em lote - parcela 235”
  e “parcela 234”). São dois pagamentos disputando duas transações alheias —
  ambiguidade que não permite escolher.
- O pagamento de R$ 100,00 de 11/04 (contrato 92) tem duas candidatas (`210`
  “Dona Maria” e `214` sem descrição, conta 14), também ambíguas.
- O de R$ 100,00 de 16/03 (contrato 70) tem uma candidata (`116`, conta 1, sem
  descrição), sem vínculo com o pagamento.
- Todas as candidatas retornadas estão em `environment=test`; os ids das
  candidatas são diferentes dos ids das transações realmente vinculadas.

**Conclusão mantida:** nenhuma conta é recuperável. Não preencher `account_id`
nem trocar `financial_transaction_id` com base em valor/data. O bloco
`pagamentos_sem_conta` de `auditoria_contratos_completa` confirmou os mesmos 9
pagamentos: `total=9`, `com_conta_na_transacao=0`, `sem_conta_na_transacao=9`,
`sem_transacao=4`. As candidatas por valor/data continuam ambíguas, em
`environment=test` e com descrições de outras parcelas.

## 4. Estado da auditoria — fechada em 24/11/2026

| Achado | Situação | Resultado |
|---|---|---|
| “17 totais inconsistentes” | Fechado — falso positivo | `totais_formula_trigger`: 44/44 explicados, 0 não explicados |
| 26 parcelas acima do valor | Fechado — entrada real | `pago == SUM(payments)` nos 26; não reduzir `amountPaid` |
| 9 pagamentos sem conta | Fechado — irrecuperável | 0 contas na transação, 4 sem transação; não inferir conta |
| Escrita em banco | Nenhuma | Nenhum UPDATE/DELETE executado; auditoria inteiramente somente leitura |

O script consolidado `docs/AUDITORIA-CONTRATOS-COMPLETA-20261124.sql` (commit
`de19564`) contém a única célula necessária, já executada e interpretada. Não há
célula pendente.

Correções estruturais mapeadas (policies do portal com
`_rls_can_access(environment)`, views que não excluem `Estornado`,
`search_all(text,text)` quebrada por `contractNumber`, `UNIQUE(contract_id,
"installmentNumber")` e índices em `payments`/`installments`/
`commission_payments`) **não foram aplicadas** e dependem de autorização
explícita e medição prévia.

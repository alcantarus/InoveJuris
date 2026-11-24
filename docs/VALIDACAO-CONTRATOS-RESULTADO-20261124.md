# Resultado da validação final — Contratos (24/11/2026)

Fonte: célula `validacao_contratos` de `docs/VALIDACAO-CONTRATOS-20261124.sql`,
executada no SQL Editor e colada pelo usuário. `coletado_em =
2026-11-24T17:51:38.404718+00:00`. Somente leitura; nenhuma escrita em banco.

## 1. O que a validação respondeu

| Bloco | Resultado | Conclusão |
|---|---:|---|
| `excesso_vs_juros_multa` | 26 candidatos, **0 explicados**, **26 não explicados** | Hipótese de juros/multa **refutada**. Em toda a amostra `interest=0` e `fine=0`, logo `diferenca = excesso`. |
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

Isso é compatível com **juros/multa embutidos no valor pago, mas não gravados em
`interest`/`fine`** — comportamento possível nas rotinas legadas que somavam
`p_amount_paid` em `amountPaid` sem preencher as colunas de acréscimo. Também é
compatível com excesso real (pagamento acima do principal) ou com acumulação
duplicada. As três possibilidades precisam ser distinguidas antes de escrever.

> Por isso **não foi preparado UPDATE**. Reduzir `amountPaid` para `amount` sem
> confirmar o histórico de `payments`/`financial_transactions` poderia dessincronizar
> o caixa e a auditoria.

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
nem trocar `financial_transaction_id` com base em valor/data.

## 4. Estado da auditoria

- Fechado: totais (44/44) e pagamentos sem conta (0 contas recuperáveis).
- Aberto: os 26 pagamentos acima do valor da parcela.
- Recebido de `docs/INVESTIGACAO-EXCESSO-26-20261124.sql`: apenas a célula
  `candidatos_conta_9`; **falta a célula `investigacao_excesso_26`**, que é a
  necessária para decidir os 26.
- Qualquer UPDATE continua dependendo de autorização explícita, backup dos valores
  anteriores, `WHERE id = ...` pontual e rollback.

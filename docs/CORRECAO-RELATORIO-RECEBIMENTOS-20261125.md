# Correção — recebimentos estornados no Relatório de Recebimentos (25/11/2026)

## Sintoma

No **Relatórios → Relatório de Recebimentos**, o contrato 120 (Jessica Gomes Alves de Souza) aparecia com três linhas em 25/11/2026:

| Data | Descrição | Valor |
|---|---|---|
| 25/11/2026 | Recebimentos 01/02 Jessica São Paulo | R$ 811,00 |
| 25/11/2026 | Recebimentos 01/02 Jessica São Paulo | R$ 1.621,00 |
| 25/11/2026 | Estorno: Erro no recebimento | R$ 1.621,00 |

Só o recebimento de **R$ 811,00** aconteceu de fato. O par de R$ 1.621,00 foi recebido e estornado, mas continuava listado e **somava** no total do período.

## Causa raiz

O relatório consulta `payments` diretamente (`app/relatorios/page.tsx`) e o filtro era:

```ts
const passesType = item.type !== 'reversal' || Number(item.amount) > 0;
```

Dois problemas:

1. o estorno é gravado com **valor positivo** (`payments.type = 'reversal'`), então passava no `Number(item.amount) > 0` e entrava somando;
2. o pagamento original **não é apagado** pelo estorno — só a transação de caixa é removida. Assim, o R$ 1.621,00 original continuava listado.

Resultado: total do período inflado em R$ 1.621,00 e lançamentos contados em dobro.

## Correção aplicada

Novo helper compartilhado em `lib/payments.ts`:

- `getReversedPaymentIds(payments)` — identifica os pagamentos desfeitos por estorno, usando `reverses_payment_id` quando existe e, para estornos antigos sem vínculo, casando valor + parcela;
- `filterEffectiveReceipts(payments)` — remove as linhas de estorno **e** os pagamentos originais estornados.

Aplicado em:

| Arquivo | Uso |
|---|---|
| `app/relatorios/page.tsx` | Relatório de Recebimentos (lista, total e contagem) |
| `app/contas-a-receber/page.tsx` | KPI **Recebido este Mês** (mesmo defeito: excluía a reversão, mas contava o original) |

A consulta do relatório passou a trazer `installment_id` e `reverses_payment_id` para permitir o vínculo.

Nenhuma alteração de banco, view, dados ou RPC. O **Extrato de Recebimentos** do contrato continua exibindo o histórico completo (recebimento, estorno e novo recebimento), porque ali o objetivo é auditoria.

## Resultado esperado

Para o contrato 120 em 25/11/2026:

- apenas **R$ 811,00** listado;
- total do período reduzido em R$ 1.621,00;
- contagem de lançamentos sem o par estornado.

## Verificação

- `npx tsc --noEmit` sem erros;
- vínculo do estorno confirmado em produção: o `payments` de estorno da parcela 207 tem `reverses_payment_id` apontando para o pagamento original de 1.621,00 (diagnóstico de 25/11/2026, somente leitura);
- conferência visual pendente pelo usuário na tela de Relatórios.
